package org.openemr2026.development;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Component
@Profile("dev-synthetic")
final class SyntheticDataImporter implements ApplicationRunner {

    static final UUID TENANT_ID = UUID.fromString("018f0000-0000-7000-8000-00000000aa01");
    static final UUID ORGANIZATION_ID = UUID.fromString("018f0000-0000-7000-8000-00000000aa02");
    static final UUID FACILITY_ID = UUID.fromString("018f0000-0000-7000-8000-00000000aa03");
    static final UUID USER_ID = UUID.fromString("018f0000-0000-7000-8000-00000000aa04");
    static final UUID ROLE_ASSIGNMENT_ID = UUID.fromString("018f0000-0000-7000-8000-00000000aa05");
    static final UUID ADMIN_ROLE_ASSIGNMENT_ID = UUID.fromString("018f0000-0000-7000-8000-00000000aa09");
    static final UUID COLLABORATOR_USER_ID = UUID.fromString("018f0000-0000-7000-8000-00000000aa06");
    static final UUID COLLABORATOR_ROLE_ID = UUID.fromString("018f0000-0000-7000-8000-00000000aa07");
    static final UUID SYNTHETIC_DEPARTMENT_ID = UUID.fromString("018f0000-0000-7000-8000-00000000aa08");
    static final UUID SYNTHETIC_WARD_ID = UUID.fromString("018f0000-0000-7000-8000-00000000bb01");
    static final UUID SYNTHETIC_BED_ID = UUID.fromString("018f0000-0000-7000-8000-00000000bb02");
    static final UUID SYNTHETIC_FREE_BED_ID = UUID.fromString("018f0000-0000-7000-8000-00000000bb09");
    static final UUID SYNTHETIC_ADMISSION_ID = UUID.fromString("018f0000-0000-7000-8000-00000000bb03");
    static final UUID ATTENDING_USER_ID = UUID.fromString("018f0000-0000-7000-8000-00000000aa10");
    static final UUID ATTENDING_ROLE_ID = UUID.fromString("018f0000-0000-7000-8000-00000000aa11");
    static final UUID CHIEF_USER_ID = UUID.fromString("018f0000-0000-7000-8000-00000000aa12");
    static final UUID CHIEF_ROLE_ID = UUID.fromString("018f0000-0000-7000-8000-00000000aa13");
    static final UUID MEDICAL_RECORDS_USER_ID = UUID.fromString("018f0000-0000-7000-8000-00000000aa14");
    static final UUID MEDICAL_RECORDS_ROLE_ID = UUID.fromString("018f0000-0000-7000-8000-00000000aa15");
    static final UUID HEART_FAILURE_PATHWAY_ID = UUID.fromString("018f0000-0000-7000-8000-00000000cc01");
    static final UUID HEART_FAILURE_PATHWAY_V1_ID = UUID.fromString("018f0000-0000-7000-8000-00000000cc02");

    private final JdbcClient jdbc;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate transactions;
    private final Path datasetPath;

    SyntheticDataImporter(
            JdbcClient jdbc,
            ObjectMapper objectMapper,
            TransactionTemplate transactions,
            @Value("${openemr2026.synthetic-dataset:samples/data/synthetic-clinical-golden-v1.json}") String datasetPath) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
        this.transactions = transactions;
        this.datasetPath = Path.of(datasetPath);
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        String json = Files.readString(datasetPath, StandardCharsets.UTF_8);
        SyntheticDataset.parse(objectMapper, json);
        JsonNode root = objectMapper.readTree(json);
        transactions.executeWithoutResult(status -> importRoot(root));
    }

    private void importRoot(JsonNode root) {
        upsertInfrastructure();
        upsertInpatientDocumentRules();
        upsertClinicalPathwayDefinitions();
        upsertDocumentTemplates(root);
        for (JsonNode item : root.path("cases")) {
            upsertCase(item);
        }
        upsertInpatientFixture();
    }

    private void upsertDocumentTemplates(JsonNode root) {
        jdbc.sql("""
                select document_type_code, display_name, template_sections::text
                from inpatient_document_rule where tenant_id = :tenant and status = 'ACTIVE'
                """).param("tenant", TENANT_ID)
                .query((rs, row) -> new SyntheticTemplate(
                        rs.getString("document_type_code"), rs.getString("display_name"),
                        objectMapper.readTree(rs.getString("template_sections"))))
                .list().forEach(template -> ensureDocumentTemplate(
                        template.documentTypeCode(), template.displayName(), template.sections()));
        for (JsonNode item : root.path("cases")) {
            for (JsonNode document : item.path("documents")) {
                List<String> fields = new ArrayList<>();
                fields.addAll(document.path("sections").propertyNames());
                ensureDocumentTemplate(document.path("document_type_code").stringValue(),
                        document.path("document_type_code").stringValue(), objectMapper.valueToTree(fields));
            }
        }
    }

    private void ensureDocumentTemplate(String documentTypeCode, String displayName, JsonNode sections) {
        long existing = jdbc.sql("""
                select count(*) from clinical_document_template template
                join clinical_document_template_version version
                  on version.tenant_id = template.tenant_id and version.template_id = template.template_id
                where template.tenant_id = :tenant and template.document_type_code = :type
                  and template.lifecycle_status = 'ACTIVE' and version.status = 'PUBLISHED'
                """).param("tenant", TENANT_ID).param("type", documentTypeCode).query(Long.class).single();
        if (existing > 0) return;
        UUID templateId = UUID.nameUUIDFromBytes(
                ("synthetic-template:" + documentTypeCode).getBytes(StandardCharsets.UTF_8));
        UUID versionId = UUID.nameUUIDFromBytes(
                ("synthetic-template-version:" + documentTypeCode + ":1").getBytes(StandardCharsets.UTF_8));
        List<String> requiredFields = new ArrayList<>();
        sections.forEach(value -> requiredFields.add(value.stringValue()));
        Map<String, Object> properties = new LinkedHashMap<>();
        requiredFields.forEach(field -> properties.put(field, Map.of("type", "string")));
        String schema;
        try {
            schema = objectMapper.writeValueAsString(Map.of(
                    "type", "object", "properties", properties, "additionalProperties", true));
        } catch (Exception impossible) {
            throw new IllegalStateException("Synthetic template schema is invalid", impossible);
        }
        jdbc.sql("""
                insert into clinical_document_template(
                  tenant_id, template_id, template_code, display_name, document_type_code, created_by)
                values (:tenant, :template, :code, :display_name, :type, :creator)
                on conflict (tenant_id, template_id) do nothing
                """).param("tenant", TENANT_ID).param("template", templateId)
                .param("code", "SYNTHETIC." + templateId).param("display_name", displayName)
                .param("type", documentTypeCode).param("creator", USER_ID).update();
        jdbc.sql("""
                insert into clinical_document_template_version(
                  tenant_id, template_id, template_version_id, version_no, status,
                  section_schema, required_fields, display_rules, effective_from,
                  created_by, approved_by, published_at)
                values (:tenant, :template, :version, 1, 'PUBLISHED', cast(:schema as jsonb),
                  cast(:required as text[]), '{"synthetic":true}'::jsonb, now() - interval '1 day',
                  :creator, :approver, now() - interval '1 day')
                on conflict (tenant_id, template_id, template_version_id) do nothing
                """).param("tenant", TENANT_ID).param("template", templateId).param("version", versionId)
                .param("schema", schema).param("required", "{" + String.join(",", requiredFields) + "}")
                .param("creator", USER_ID).param("approver", COLLABORATOR_USER_ID).update();
    }

    private void upsertInpatientDocumentRules() {
        jdbc.sql("""
                insert into inpatient_document_rule(
                  tenant_id, rule_code, document_type_code, display_name, category_code, trigger_type,
                  due_minutes, required_signature_level, template_sections, status)
                select :tenant, seed.rule_code, seed.document_type_code, seed.display_name,
                  seed.category_code, seed.trigger_type, seed.due_minutes, seed.signature_level,
                  seed.sections::jsonb, 'ACTIVE'
                from (values
                  ('IP-ADMISSION', 'WS445.5.ADMISSION_RECORD', '入院记录', 'ADMISSION', 'ADMISSION', 1440, 'ATTENDING', '["chief_complaint","present_illness","past_history","personal_history","marital_history","family_history","physical_examination","specialty_examination","diagnostic_basis","differential_diagnosis","assessment","treatment_plan","communication"]'),
                  ('IP-FIRST-COURSE', 'WS445.5.FIRST_COURSE_RECORD', '首次病程记录', 'COURSE', 'ADMISSION', 480, 'ATTENDING', '["case_features","provisional_diagnosis","diagnostic_basis","differential_diagnosis","risk_assessment","treatment_plan","communication"]'),
                  ('IP-ATTENDING-ROUND', 'WS445.5.ATTENDING_REVIEW', '主治医师首次查房记录', 'ROUND', 'ADMISSION', 2880, 'ATTENDING', '["round_time","participants","history_supplement","examination_findings","diagnostic_analysis","treatment_adjustment","attending_opinion"]'),
                  ('IP-DAILY-COURSE', 'WS445.5.DAILY_COURSE_RECORD', '日常病程记录', 'COURSE', 'DAILY', 1440, 'AUTHOR', '["event_time","condition_change","examination_findings","result_analysis","treatment_response","assessment","treatment_plan","communication"]'),
                  ('IP-CHIEF-ROUND', 'WS445.5.CHIEF_REVIEW', '主任医师查房记录', 'ROUND', 'MANUAL', 1440, 'CHIEF', '["round_time","participants","case_summary","diagnostic_analysis","differential_diagnosis","treatment_guidance","chief_opinion"]'),
                  ('IP-STAGE-SUMMARY', 'WS445.5.STAGE_SUMMARY', '阶段小结', 'COURSE', 'MANUAL', 1440, 'ATTENDING', '["period","admission_summary","diagnosis_evolution","treatment_course","current_condition","next_plan"]'),
                  ('IP-CONSULTATION', 'WS445.5.CONSULTATION_RECORD', '会诊记录', 'CONSULTATION', 'EVENT', 1440, 'ATTENDING', '["request_time","consultation_time","reason","consultant","consultation_opinion","disposition"]'),
                  ('IP-TRANSFER', 'WS445.5.TRANSFER_RECORD', '转科记录', 'EVENT', 'EVENT', 360, 'ATTENDING', '["transfer_time","from_department","to_department","condition_before_transfer","diagnosis","treatment_course","transfer_reason","handover_plan"]'),
                  ('IP-PREOPERATIVE', 'WS445.5.PREOPERATIVE_SUMMARY', '术前小结', 'PERIOPERATIVE', 'EVENT', 720, 'ATTENDING', '["preoperative_diagnosis","surgical_indication","operation_plan","risk_assessment","preparation","consent"]'),
                  ('IP-OPERATION', 'WS445.5.OPERATION_RECORD', '手术记录', 'PERIOPERATIVE', 'EVENT', 1440, 'ATTENDING', '["operation_time","preoperative_diagnosis","postoperative_diagnosis","operation_name","surgeon","anesthesia","procedure","findings","specimen","complications"]'),
                  ('IP-RESCUE', 'WS445.5.RESCUE_RECORD', '抢救记录', 'EVENT', 'EVENT', 360, 'ATTENDING', '["event_time","recorded_time","condition","participants","measures","medications","response","outcome","late_entry_reason"]'),
                  ('IP-TRANSFUSION', 'WS445.5.TRANSFUSION_RECORD', '输血记录', 'EVENT', 'EVENT', 360, 'ATTENDING', '["indication","consent","blood_component","verification","start_time","end_time","monitoring","reaction","outcome"]'),
                  ('IP-CRITICAL', 'WS445.5.CRITICAL_ILLNESS_RECORD', '病危病重记录', 'EVENT', 'EVENT', 360, 'ATTENDING', '["event_time","severity","clinical_basis","treatment","communication","family_acknowledgement"]'),
                  ('IP-DISCHARGE', 'WS445.5.DISCHARGE_RECORD', '出院记录', 'TERMINAL', 'DISCHARGE', 1440, 'ATTENDING', '["admission_diagnosis","discharge_diagnosis","admission_condition","treatment_course","discharge_condition","discharge_medication","follow_up","education"]'),
                  ('IP-DEATH', 'WS445.5.DEATH_RECORD', '死亡记录', 'TERMINAL', 'EVENT', 1440, 'CHIEF', '["death_time","admission_condition","treatment_course","rescue_process","cause_of_death","death_diagnosis","family_communication"]'),
                  ('IP-FOUR-LEVEL-E2E', 'SYNTHETIC.FOUR_LEVEL_REVIEW', '四级审签验收文书', 'COURSE', 'MANUAL', 1440, 'MEDICAL_RECORDS', '["case_summary","diagnostic_basis","treatment_course","quality_conclusion"]')
                ) as seed(rule_code, document_type_code, display_name, category_code, trigger_type,
                  due_minutes, signature_level, sections)
                on conflict (tenant_id, rule_code) do nothing
                """).param("tenant", TENANT_ID).update();
    }

    private void upsertClinicalPathwayDefinitions() {
        jdbc.sql("""
                insert into clinical_pathway_definition(
                  tenant_id, pathway_definition_id, pathway_code, display_name,
                  specialty_code, diagnosis_code, status, created_by)
                values (:tenant, :definition, 'HF-INPATIENT', '心力衰竭住院标准路径',
                  'CARDIOLOGY', 'I50', 'ACTIVE', :creator)
                on conflict (tenant_id, pathway_definition_id) do nothing
                """).param("tenant", TENANT_ID).param("definition", HEART_FAILURE_PATHWAY_ID)
                .param("creator", USER_ID).update();
        jdbc.sql("""
                insert into clinical_pathway_version(
                  tenant_id, pathway_version_id, pathway_definition_id, version_no, status,
                  admission_criteria, created_by, approved_by, created_at, published_at)
                values (:tenant, :version, :definition, 1, 'PUBLISHED',
                  '主要诊断为心力衰竭，临床医生已核对诊断、禁忌证、合并症与患者意愿后确认入径。',
                  :creator, :approver, now() - interval '2 days', now() - interval '1 day')
                on conflict (tenant_id, pathway_version_id) do nothing
                """).param("tenant", TENANT_ID).param("version", HEART_FAILURE_PATHWAY_V1_ID)
                .param("definition", HEART_FAILURE_PATHWAY_ID).param("creator", USER_ID)
                .param("approver", ATTENDING_USER_ID).update();
        jdbc.sql("""
                insert into clinical_pathway_stage(
                  tenant_id, pathway_version_id, stage_code, display_name, sequence_no,
                  expected_day_start, expected_day_end)
                select :tenant, :version, seed.stage_code, seed.display_name,
                  seed.sequence_no, seed.day_start, seed.day_end
                from (values
                  ('ADMISSION_ASSESSMENT', '入院评估', 1, 0, 1),
                  ('DIAGNOSIS_TREATMENT', '诊断与治疗监测', 2, 1, 7),
                  ('DISCHARGE_PREPARATION', '稳定与出院准备', 3, 3, 14)
                ) as seed(stage_code, display_name, sequence_no, day_start, day_end)
                on conflict (tenant_id, pathway_version_id, stage_code) do nothing
                """).param("tenant", TENANT_ID).param("version", HEART_FAILURE_PATHWAY_V1_ID).update();
        jdbc.sql("""
                insert into clinical_pathway_stage_task(
                  tenant_id, pathway_version_id, stage_code, task_code, display_name,
                  source_type, source_key, required, sequence_no)
                select :tenant, :version, seed.stage_code, seed.task_code, seed.display_name,
                  seed.source_type, seed.source_key, seed.required, seed.sequence_no
                from (values
                  ('ADMISSION_ASSESSMENT', 'ADMISSION_RECORD', '完成并审签入院记录',
                    'DOCUMENT_TASK', 'WS445.5.ADMISSION_RECORD', true, 1),
                  ('ADMISSION_ASSESSMENT', 'FIRST_COURSE', '完成并审签首次病程记录',
                    'DOCUMENT_TASK', 'WS445.5.FIRST_COURSE_RECORD', true, 2),
                  ('DIAGNOSIS_TREATMENT', 'TROPONIN_RESULT', '完成肌钙蛋白医嘱及执行',
                    'ORDER_ITEM', 'LAB.TROPONIN.I', true, 1),
                  ('DIAGNOSIS_TREATMENT', 'DAILY_COURSE', '形成日常病程记录',
                    'DOCUMENT_TASK', 'WS445.5.DAILY_COURSE_RECORD', false, 2),
                  ('DISCHARGE_PREPARATION', 'DISCHARGE_RECORD', '完成并审签出院记录',
                    'DOCUMENT_TASK', 'WS445.5.DISCHARGE_RECORD', true, 1)
                ) as seed(stage_code, task_code, display_name, source_type, source_key, required, sequence_no)
                on conflict (tenant_id, pathway_version_id, task_code) do nothing
                """).param("tenant", TENANT_ID).param("version", HEART_FAILURE_PATHWAY_V1_ID).update();
    }

    private void upsertInfrastructure() {
        jdbc.sql("insert into tenant(tenant_id, tenant_code, display_name, status) values (:id, 'SYNTHETIC', 'openemr2026 合成机构', 'ACTIVE') on conflict (tenant_id) do nothing")
                .param("id", TENANT_ID).update();
        jdbc.sql("insert into organization(tenant_id, organization_id, organization_code, display_name, status) values (:tenant, :id, 'SYN-ORG', '合成医院', 'ACTIVE') on conflict (tenant_id, organization_id) do nothing")
                .param("tenant", TENANT_ID).param("id", ORGANIZATION_ID).update();
        jdbc.sql("insert into facility(tenant_id, organization_id, facility_id, facility_code, display_name, status) values (:tenant, :org, :id, 'SYN-FAC', '合成院区', 'ACTIVE') on conflict (tenant_id, facility_id) do nothing")
                .param("tenant", TENANT_ID).param("org", ORGANIZATION_ID).param("id", FACILITY_ID).update();
        jdbc.sql("insert into app_user(tenant_id, user_id, external_subject, display_name, status) values (:tenant, :id, 'synthetic-clinician', '合成临床用户', 'ACTIVE') on conflict (tenant_id, user_id) do nothing")
                .param("tenant", TENANT_ID).param("id", USER_ID).update();
        jdbc.sql("insert into app_user(tenant_id, user_id, external_subject, display_name, status) values (:tenant, :id, 'synthetic-collaborator', '合成协作医生', 'ACTIVE') on conflict (tenant_id, user_id) do nothing")
                .param("tenant", TENANT_ID).param("id", COLLABORATOR_USER_ID).update();
        upsertSyntheticReviewer(ATTENDING_USER_ID, ATTENDING_ROLE_ID,
                "synthetic-attending", "合成主治医师", "ATTENDING_PHYSICIAN");
        upsertSyntheticReviewer(CHIEF_USER_ID, CHIEF_ROLE_ID,
                "synthetic-chief", "合成科主任", "CHIEF_PHYSICIAN");
        upsertSyntheticReviewer(MEDICAL_RECORDS_USER_ID, MEDICAL_RECORDS_ROLE_ID,
                "synthetic-medical-records", "合成病案人员", "MEDICAL_RECORDS");
        jdbc.sql("""
                insert into role_assignment(tenant_id, role_assignment_id, user_id, organization_id,
                  facility_id, role_code, valid_from, status)
                values (:tenant, :role, :user, :org, :facility, 'CLINICIAN', now(), 'ACTIVE')
                on conflict (tenant_id, role_assignment_id) do nothing
                """)
                .param("tenant", TENANT_ID).param("role", ROLE_ASSIGNMENT_ID).param("user", USER_ID)
                .param("org", ORGANIZATION_ID).param("facility", FACILITY_ID).update();
        jdbc.sql("""
                insert into role_assignment(tenant_id, role_assignment_id, user_id, organization_id,
                  facility_id, role_code, valid_from, status)
                values (:tenant, :role, :user, :org, :facility, 'SYSTEM_ADMIN', now(), 'ACTIVE')
                on conflict (tenant_id, role_assignment_id) do nothing
                """)
                .param("tenant", TENANT_ID).param("role", ADMIN_ROLE_ASSIGNMENT_ID).param("user", USER_ID)
                .param("org", ORGANIZATION_ID).param("facility", FACILITY_ID).update();
        jdbc.sql("""
                insert into role_assignment(tenant_id, role_assignment_id, user_id, organization_id,
                  facility_id, role_code, valid_from, status)
                values (:tenant, :role, :user, :org, :facility, 'CLINICIAN', now(), 'ACTIVE')
                on conflict (tenant_id, role_assignment_id) do nothing
                """).param("tenant", TENANT_ID).param("role", COLLABORATOR_ROLE_ID)
                .param("user", COLLABORATOR_USER_ID).param("org", ORGANIZATION_ID)
                .param("facility", FACILITY_ID).update();
        jdbc.sql("""
                insert into ai_use_case_policy(
                  tenant_id, use_case_code, enabled, provider_code, model_code,
                  model_residency_policy, prompt_version)
                values (:tenant, 'DOCUMENT_DRAFT_ASSIST', true, 'DETERMINISTIC_FAKE',
                  'openemr2026-ci-fake-v1', 'ON_PREM_ONLY', 'draft-assist-v1')
                on conflict (tenant_id, use_case_code) do update
                set enabled = excluded.enabled, provider_code = excluded.provider_code,
                  model_code = excluded.model_code,
                  model_residency_policy = excluded.model_residency_policy,
                  prompt_version = excluded.prompt_version, updated_at = now(),
                  config_version = ai_use_case_policy.config_version + 1
                where (ai_use_case_policy.enabled, ai_use_case_policy.provider_code,
                  ai_use_case_policy.model_code, ai_use_case_policy.model_residency_policy,
                  ai_use_case_policy.prompt_version)
                  is distinct from (excluded.enabled, excluded.provider_code,
                    excluded.model_code, excluded.model_residency_policy, excluded.prompt_version)
                """).param("tenant", TENANT_ID).update();
    }

    private void upsertSyntheticReviewer(
            UUID userId, UUID roleAssignmentId, String subject, String displayName, String roleCode) {
        jdbc.sql("""
                insert into app_user(tenant_id, user_id, external_subject, display_name, status)
                values (:tenant, :user, :subject, :display_name, 'ACTIVE')
                on conflict (tenant_id, user_id) do update
                set display_name = excluded.display_name, status = 'ACTIVE'
                """).param("tenant", TENANT_ID).param("user", userId).param("subject", subject)
                .param("display_name", displayName).update();
        jdbc.sql("""
                insert into role_assignment(tenant_id, role_assignment_id, user_id, organization_id,
                  facility_id, role_code, valid_from, status)
                values (:tenant, :role, :user, :org, :facility, :role_code, now(), 'ACTIVE')
                on conflict (tenant_id, role_assignment_id) do update
                set role_code = excluded.role_code, status = 'ACTIVE', valid_until = null
                """).param("tenant", TENANT_ID).param("role", roleAssignmentId).param("user", userId)
                .param("org", ORGANIZATION_ID).param("facility", FACILITY_ID).param("role_code", roleCode).update();
    }

    private void upsertCase(JsonNode item) {
        JsonNode patient = item.path("patient");
        UUID patientId = UUID.fromString(patient.path("patient_id").stringValue());
        jdbc.sql("""
                insert into patient(tenant_id, patient_id, display_name, sex_code, birth_date, status)
                values (:tenant, :patient, :name, :sex, cast(:birth_date as date), 'ACTIVE')
                on conflict (tenant_id, patient_id) do update
                set display_name = excluded.display_name, sex_code = excluded.sex_code,
                    birth_date = excluded.birth_date, updated_at = now(), row_version = patient.row_version + 1
                where (patient.display_name, patient.sex_code, patient.birth_date)
                  is distinct from (excluded.display_name, excluded.sex_code, excluded.birth_date)
                """)
                .param("tenant", TENANT_ID).param("patient", patientId)
                .param("name", patient.path("display_name").stringValue())
                .param("sex", patient.path("gender_code").stringValue())
                .param("birth_date", patient.path("birth_date").stringValue()).update();

        JsonNode encounter = item.path("encounter");
        UUID encounterId = UUID.fromString(encounter.path("encounter_id").stringValue());
        jdbc.sql("""
                insert into encounter(tenant_id, encounter_id, patient_id, organization_id, facility_id,
                  encounter_type, status, started_at, source_system, source_key)
                values (:tenant, :encounter, :patient, :org, :facility, :type, :status,
                  cast(:started_at as timestamptz), 'SYNTHETIC', :source_key)
                on conflict (tenant_id, encounter_id) do nothing
                """)
                .param("tenant", TENANT_ID).param("encounter", encounterId).param("patient", patientId)
                .param("org", ORGANIZATION_ID).param("facility", FACILITY_ID)
                .param("type", encounter.path("encounter_type").stringValue())
                .param("status", encounter.path("status").stringValue())
                .param("started_at", OffsetDateTime.parse(encounter.path("started_at").stringValue()).toString())
                .param("source_key", item.path("case_id").stringValue()).update();

        for (JsonNode document : item.path("documents")) {
            upsertDocument(patientId, encounterId, document);
        }
    }

    private void upsertInpatientFixture() {
        UUID patientId = UUID.fromString("018f0000-0000-7000-8000-000000000002");
        UUID encounterId = UUID.fromString("018f0000-0000-7000-8000-000000000102");
        OffsetDateTime admittedAt = OffsetDateTime.parse("2026-08-13T16:10:00+08:00");
        jdbc.sql("""
                insert into clinical_department(
                  tenant_id, facility_id, department_id, department_code, display_name, status, unit_type)
                values (:tenant, :facility, :department, 'SYN-CARDIO-DEPT', '合成心内科', 'ACTIVE', 'DEPARTMENT')
                on conflict (tenant_id, facility_id, department_id) do nothing
                """).param("tenant", TENANT_ID).param("facility", FACILITY_ID)
                .param("department", SYNTHETIC_DEPARTMENT_ID).update();
        jdbc.sql("""
                insert into clinical_ward(
                  tenant_id, facility_id, department_id, ward_id, ward_code, display_name, status)
                values (:tenant, :facility, :department, :ward, 'SYN-CARDIO', '合成心内科病区', 'ACTIVE')
                on conflict (tenant_id, ward_id) do nothing
                """).param("tenant", TENANT_ID).param("facility", FACILITY_ID)
                .param("department", SYNTHETIC_DEPARTMENT_ID)
                .param("ward", SYNTHETIC_WARD_ID).update();
        jdbc.sql("""
                insert into clinical_bed(tenant_id, bed_id, ward_id, bed_label, status)
                values (:tenant, :bed, :ward, '02', 'ACTIVE')
                on conflict (tenant_id, bed_id) do nothing
                """).param("tenant", TENANT_ID).param("bed", SYNTHETIC_BED_ID)
                .param("ward", SYNTHETIC_WARD_ID).update();
        jdbc.sql("""
                insert into clinical_bed(tenant_id, bed_id, ward_id, bed_label, status)
                values (:tenant, :bed, :ward, '03', 'ACTIVE')
                on conflict (tenant_id, bed_id) do nothing
                """).param("tenant", TENANT_ID).param("bed", SYNTHETIC_FREE_BED_ID)
                .param("ward", SYNTHETIC_WARD_ID).update();
        jdbc.sql("""
                insert into ward_role_scope(tenant_id, ward_id, role_assignment_id)
                values (:tenant, :ward, :role)
                on conflict (tenant_id, ward_id, role_assignment_id) do nothing
                """).param("tenant", TENANT_ID).param("ward", SYNTHETIC_WARD_ID)
                .param("role", ROLE_ASSIGNMENT_ID).update();
        List.of(ATTENDING_ROLE_ID, CHIEF_ROLE_ID, MEDICAL_RECORDS_ROLE_ID).forEach(roleId -> jdbc.sql("""
                insert into ward_role_scope(tenant_id, ward_id, role_assignment_id)
                values (:tenant, :ward, :role)
                on conflict (tenant_id, ward_id, role_assignment_id) do nothing
                """).param("tenant", TENANT_ID).param("ward", SYNTHETIC_WARD_ID)
                .param("role", roleId).update());
        jdbc.sql("""
                insert into inpatient_admission(
                  tenant_id, admission_id, encounter_id, patient_id, facility_id, ward_id,
                  current_bed_id, attending_user_id, status, admitted_at)
                values (:tenant, :admission, :encounter, :patient, :facility, :ward,
                  :bed, :attending, 'ADMITTED', :admitted_at)
                on conflict (tenant_id, admission_id) do nothing
                """).param("tenant", TENANT_ID).param("admission", SYNTHETIC_ADMISSION_ID)
                .param("encounter", encounterId).param("patient", patientId).param("facility", FACILITY_ID)
                .param("ward", SYNTHETIC_WARD_ID).param("bed", SYNTHETIC_BED_ID)
                .param("attending", USER_ID).param("admitted_at", admittedAt).update();
        jdbc.sql("""
                insert into bed_occupancy(
                  tenant_id, bed_occupancy_id, admission_id, ward_id, bed_id, started_at)
                values (:tenant, :occupancy, :admission, :ward, :bed, :started_at)
                on conflict (tenant_id, bed_occupancy_id) do nothing
                """).param("tenant", TENANT_ID)
                .param("occupancy", UUID.fromString("018f0000-0000-7000-8000-00000000bb04"))
                .param("admission", SYNTHETIC_ADMISSION_ID).param("ward", SYNTHETIC_WARD_ID)
                .param("bed", SYNTHETIC_BED_ID).param("started_at", admittedAt).update();
        upsertInpatientTask("018f0000-0000-7000-8000-00000000bb05", "WS445.5.ADMISSION_RECORD",
                admittedAt.plusHours(24));
        upsertInpatientTask("018f0000-0000-7000-8000-00000000bb06", "WS445.5.FIRST_COURSE_RECORD",
                admittedAt.plusHours(8));
        upsertInpatientTask("018f0000-0000-7000-8000-00000000bb07", "WS445.5.ATTENDING_REVIEW",
                admittedAt.plusHours(48));
        upsertInpatientTask("018f0000-0000-7000-8000-00000000bb08", "SYNTHETIC.FOUR_LEVEL_REVIEW",
                admittedAt.plusHours(72));
    }

    private void upsertInpatientTask(String taskId, String documentTypeCode, OffsetDateTime dueAt) {
        jdbc.sql("""
                insert into inpatient_document_task(
                  tenant_id, task_id, admission_id, document_type_code, task_state, due_at,
                  occurrence_key, rule_version, required_signature_level)
                values (:tenant, :task, :admission, :type, 'PENDING', :due_at, 'ADMISSION', 1,
                  (select required_signature_level from inpatient_document_rule
                   where tenant_id = :tenant and document_type_code = :type and rule_version = 1
                   order by rule_code limit 1))
                on conflict (tenant_id, task_id) do nothing
                """).param("tenant", TENANT_ID).param("task", UUID.fromString(taskId))
                .param("admission", SYNTHETIC_ADMISSION_ID).param("type", documentTypeCode)
                .param("due_at", dueAt).update();
    }

    private void upsertDocument(UUID patientId, UUID encounterId, JsonNode document) {
        UUID documentId = UUID.fromString(document.path("document_id").stringValue());
        UUID versionId = UUID.nameUUIDFromBytes(("synthetic-version:" + documentId).getBytes(StandardCharsets.UTF_8));
        jdbc.sql("""
                insert into clinical_document(tenant_id, document_id, patient_id, encounter_id,
                  document_type_code, template_version_id, status, created_by)
                values (:tenant, :document, :patient, :encounter, :type,
                  (select version.template_version_id from clinical_document_template template
                    join clinical_document_template_version version
                      on version.tenant_id = template.tenant_id and version.template_id = template.template_id
                    where template.tenant_id = :tenant and template.document_type_code = :type
                      and template.lifecycle_status = 'ACTIVE' and version.status = 'PUBLISHED'
                    order by version.version_no desc limit 1), :status, :author)
                on conflict (tenant_id, document_id) do nothing
                """)
                .param("tenant", TENANT_ID).param("document", documentId).param("patient", patientId)
                .param("encounter", encounterId).param("type", document.path("document_type_code").stringValue())
                .param("status", document.path("status").stringValue()).param("author", USER_ID).update();
        jdbc.sql("""
                insert into clinical_document_version(tenant_id, document_id, document_version_id, version_no,
                  status, sections, content_hash, author_user_id)
                values (:tenant, :document, :version, :version_no, :status, cast(:sections as jsonb), :hash, :author)
                on conflict (tenant_id, document_id, document_version_id) do nothing
                """)
                .param("tenant", TENANT_ID).param("document", documentId).param("version", versionId)
                .param("version_no", document.path("version_no").asInt())
                .param("status", document.path("status").stringValue())
                .param("sections", document.path("sections").toString())
                .param("hash", document.path("content_hash").stringValue()).param("author", USER_ID).update();
        jdbc.sql("""
                update clinical_document set current_version_id = :version, updated_at = now()
                where tenant_id = :tenant and document_id = :document and current_version_id is null
                """)
                .param("version", versionId).param("tenant", TENANT_ID).param("document", documentId).update();
    }

    private record SyntheticTemplate(String documentTypeCode, String displayName, JsonNode sections) {}
}
