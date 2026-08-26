package org.openemr2026.development;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.time.LocalDate;
import java.time.YearMonth;
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
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
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
    private final Path diseaseCaseCatalogPath;
    private final String loginPassword;

    SyntheticDataImporter(
            JdbcClient jdbc,
            ObjectMapper objectMapper,
            TransactionTemplate transactions,
            @Value("${openemr2026.synthetic-dataset:samples/data/synthetic-clinical-golden-v1.json}") String datasetPath,
            @Value("${openemr2026.synthetic-disease-cases:samples/data/synthetic-50-disease-cases-v1.json}")
            String diseaseCaseCatalogPath,
            @Value("${openemr2026.dev-login-password:OpenEMR2026-dev!}") String loginPassword) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
        this.transactions = transactions;
        this.datasetPath = Path.of(datasetPath);
        this.diseaseCaseCatalogPath = Path.of(diseaseCaseCatalogPath);
        this.loginPassword = loginPassword;
    }

    @Override
    public void run(ApplicationArguments args) throws Exception {
        String json = Files.readString(datasetPath, StandardCharsets.UTF_8);
        SyntheticDataset.parse(objectMapper, json);
        JsonNode root = objectMapper.readTree(json);
        String diseaseCaseJson = Files.readString(diseaseCaseCatalogPath, StandardCharsets.UTF_8);
        SyntheticDiseaseCaseCatalog diseaseCases = SyntheticDiseaseCaseCatalog.parse(objectMapper, diseaseCaseJson);
        transactions.executeWithoutResult(status -> importRoot(root, diseaseCases));
    }

    private void importRoot(JsonNode root, SyntheticDiseaseCaseCatalog diseaseCases) {
        upsertInfrastructure();
        upsertAdministrationFixtures();
        upsertSpecialtyReferencePatients();
        upsertInpatientDocumentRules();
        upsertClinicalPathwayDefinitions();
        upsertAgentCatalog();
        upsertAiPlatformCatalog();
        upsertConfigurationFixtures();
        upsertAiAgentConfigurationFixtures();
        upsertBusinessConfigurationFixtures();
        upsertDocumentTemplates(root);
        for (JsonNode item : root.path("cases")) {
            upsertCase(item);
        }
        upsertSpecialtyReferencePatients();
        upsertOutpatientClinicalFixture();
        upsertEmergencyFixture();
        upsertInpatientFixture();
        upsertDiseaseCases(diseaseCases.cases());
        refreshPlaceholderPatientProfiles();
    }

    private void upsertEmergencyFixture() {
        UUID patientId = UUID.fromString("018f0000-0000-7000-8000-000000000003");
        UUID encounterId = UUID.fromString("018f0000-0000-7000-8000-000000000103");

        jdbc.sql("""
                insert into emergency_triage_assessment(
                  tenant_id, triage_assessment_id, patient_id, encounter_id, facility_id,
                  triage_level, chief_complaint, triaged_at, immediate_action_required, status)
                values (:tenant, '018f0000-0000-7000-8000-00000000e101'::uuid, :patient, :encounter,
                  :facility, 'LEVEL_1', '突发胸骨后压榨样疼痛伴大汗、低血压，院前心电图提示ST段抬高',
                  now() - interval '46 minutes', true, 'ACTIVE')
                on conflict (tenant_id, triage_assessment_id) do nothing
                """).param("tenant", TENANT_ID).param("patient", patientId).param("encounter", encounterId)
                .param("facility", FACILITY_ID).update();
        jdbc.sql("""
                insert into emergency_observation(
                  tenant_id, observation_id, patient_id, encounter_id, facility_id,
                  observation_started_at, disposition, status)
                values (:tenant, '018f0000-0000-7000-8000-00000000e102'::uuid, :patient, :encounter,
                  :facility, now() - interval '38 minutes', 'PENDING', 'OBSERVING')
                on conflict (tenant_id, observation_id) do nothing
                """).param("tenant", TENANT_ID).param("patient", patientId).param("encounter", encounterId)
                .param("facility", FACILITY_ID).update();
        jdbc.sql("""
                insert into emergency_resuscitation(
                  tenant_id, resuscitation_id, patient_id, encounter_id, facility_id,
                  started_at, ended_at, outcome, status)
                values (:tenant, '018f0000-0000-7000-8000-00000000e103'::uuid, :patient, :encounter,
                  :facility, now() - interval '42 minutes', now() - interval '24 minutes', 'ROSC', 'COMPLETED')
                on conflict (tenant_id, resuscitation_id) do nothing
                """).param("tenant", TENANT_ID).param("patient", patientId).param("encounter", encounterId)
                .param("facility", FACILITY_ID).update();
        jdbc.sql("""
                insert into emergency_nursing_note(
                  tenant_id, note_id, patient_id, encounter_id, facility_id,
                  assessment, intervention, risk_flag, recorded_at)
                select :tenant, seed.note_id::uuid, :patient, :encounter, :facility,
                  seed.assessment, seed.intervention, seed.risk_flag, seed.recorded_at
                from (values
                  ('018f0000-0000-7000-8000-00000000e111',
                   '胸痛持续，BP 86/54 mmHg，HR 112 次/分，SpO2 93%，皮肤湿冷，休克风险高',
                   '建立双静脉通路、持续心电监护，遵医嘱给予抗血小板及升压支持，启动导管室绿色通道',
                   true, now() - interval '41 minutes'),
                  ('018f0000-0000-7000-8000-00000000e112',
                   '复苏后意识清楚，BP 102/68 mmHg，胸痛评分由8分降至3分，仍需严密监护',
                   '复测十二导联心电图，复核肌钙蛋白危急值，通知心内科会诊并记录家属沟通',
                   true, now() - interval '22 minutes'),
                  ('018f0000-0000-7000-8000-00000000e113',
                   '转运前生命体征暂时稳定，桡动脉搏动可触及，穿刺部位皮肤完整',
                   '完成转运核查表、药物与管路交接，除颤仪及抢救药品随行',
                   false, now() - interval '8 minutes')
                ) as seed(note_id, assessment, intervention, risk_flag, recorded_at)
                on conflict (tenant_id, note_id) do nothing
                """).param("tenant", TENANT_ID).param("patient", patientId).param("encounter", encounterId)
                .param("facility", FACILITY_ID).update();
        jdbc.sql("""
                insert into emergency_preadmission(
                  tenant_id, preadmission_id, facility_id, temporary_identifier, reason, status,
                  registered_patient_id, registered_at)
                select :tenant, seed.preadmission_id::uuid, :facility, seed.temporary_identifier,
                  seed.reason, seed.status, seed.patient_id::uuid, seed.registered_at
                from (values
                  ('018f0000-0000-7000-8000-00000000e121', '急诊临时-胸痛-017',
                   '120送达，无身份证件，疑似急性心肌梗死，先救治后补登', 'UNREGISTERED', null, null),
                  ('018f0000-0000-7000-8000-00000000e122', '急诊临时-创伤-011',
                   '多发伤患者身份核验完成，已关联张慧敏', 'REGISTERED',
                   '018f0000-0000-7000-8000-000000000001', now() - interval '18 minutes')
                ) as seed(preadmission_id, temporary_identifier, reason, status, patient_id, registered_at)
                on conflict (tenant_id, preadmission_id) do nothing
                """).param("tenant", TENANT_ID).param("facility", FACILITY_ID).update();

        jdbc.sql("""
                insert into schedule_slot(
                  tenant_id, schedule_slot_id, organization_id, facility_id, department_id,
                  visit_type, slot_date, start_time, end_time, total_capacity, booked_count, status)
                values (:tenant, '018f0000-0000-7000-8000-00000000e131'::uuid, :org, :facility, null,
                  'EMERGENCY', current_date, time '00:00', time '23:59', 60, 3, 'OPEN')
                on conflict (tenant_id, schedule_slot_id) do update set slot_date = current_date,
                  booked_count = 3, status = 'OPEN', updated_at = now()
                """).param("tenant", TENANT_ID).param("org", ORGANIZATION_ID).param("facility", FACILITY_ID).update();
        jdbc.sql("""
                insert into encounter(tenant_id, encounter_id, patient_id, organization_id, facility_id,
                  encounter_type, status, started_at, source_system, source_key)
                select :tenant, seed.encounter_id::uuid, seed.patient_id::uuid, :org, :facility,
                  'EMERGENCY', 'ARRIVED', seed.started_at, 'SYNTHETIC', seed.source_key
                from (values
                  ('018f0000-0000-7000-8000-00000000e171', '018f0000-0000-7000-8000-000000000001', now() - interval '30 minutes', 'syn-er-queue-patient-1'),
                  ('018f0000-0000-7000-8000-00000000e172', '018f0000-0000-7000-8000-000000000002', now() - interval '15 minutes', 'syn-er-queue-patient-2')
                ) as seed(encounter_id, patient_id, started_at, source_key)
                on conflict (tenant_id, encounter_id) do update set status = 'ARRIVED', ended_at = null,
                  updated_at = now()
                """).param("tenant", TENANT_ID).param("org", ORGANIZATION_ID).param("facility", FACILITY_ID).update();
        jdbc.sql("""
                insert into appointment(
                  tenant_id, appointment_id, schedule_slot_id, patient_id, organization_id, facility_id,
                  visit_type, source, status, booked_at, check_in_at, encounter_id)
                select :tenant, seed.appointment_id::uuid,
                  '018f0000-0000-7000-8000-00000000e131'::uuid, seed.patient_id::uuid,
                  :org, :facility, 'EMERGENCY', 'EMERGENCY', 'CHECKED_IN', seed.booked_at,
                  seed.check_in_at, seed.encounter_id::uuid
                from (values
                  ('018f0000-0000-7000-8000-00000000e141', '018f0000-0000-7000-8000-000000000003', now() - interval '48 minutes', now() - interval '47 minutes', '018f0000-0000-7000-8000-000000000103'),
                  ('018f0000-0000-7000-8000-00000000e142', '018f0000-0000-7000-8000-000000000001', now() - interval '31 minutes', now() - interval '30 minutes', '018f0000-0000-7000-8000-00000000e171'),
                  ('018f0000-0000-7000-8000-00000000e143', '018f0000-0000-7000-8000-000000000002', now() - interval '16 minutes', now() - interval '15 minutes', '018f0000-0000-7000-8000-00000000e172')
                ) as seed(appointment_id, patient_id, booked_at, check_in_at, encounter_id)
                on conflict (tenant_id, appointment_id) do update set encounter_id = excluded.encounter_id,
                  status = 'CHECKED_IN', check_in_at = excluded.check_in_at, updated_at = now()
                """).param("tenant", TENANT_ID).param("org", ORGANIZATION_ID).param("facility", FACILITY_ID).update();
        jdbc.sql("""
                insert into waiting_queue_entry(
                  tenant_id, waiting_queue_entry_id, appointment_id, facility_id, queue_date,
                  sequence_no, status, called_at, called_by)
                select :tenant, seed.entry_id::uuid, seed.appointment_id::uuid, :facility, current_date,
                  seed.sequence_no, seed.status, seed.called_at, seed.called_by::uuid
                from (values
                  ('018f0000-0000-7000-8000-00000000e151', '018f0000-0000-7000-8000-00000000e141', 1, 'IN_CONSULTATION', now() - interval '44 minutes', '018f0000-0000-7000-8000-00000000aa04'),
                  ('018f0000-0000-7000-8000-00000000e152', '018f0000-0000-7000-8000-00000000e142', 2, 'CALLED', now() - interval '3 minutes', '018f0000-0000-7000-8000-00000000aa04'),
                  ('018f0000-0000-7000-8000-00000000e153', '018f0000-0000-7000-8000-00000000e143', 3, 'WAITING', null, null)
                ) as seed(entry_id, appointment_id, sequence_no, status, called_at, called_by)
                on conflict (tenant_id, waiting_queue_entry_id) do update set queue_date = current_date,
                  status = excluded.status, called_at = excluded.called_at, called_by = excluded.called_by,
                  updated_at = now()
                """).param("tenant", TENANT_ID).param("facility", FACILITY_ID).update();

        jdbc.sql("""
                insert into encounter(tenant_id, encounter_id, patient_id, organization_id, facility_id,
                  encounter_type, status, started_at, ended_at, source_system, source_key)
                values (:tenant, '018f0000-0000-7000-8000-00000000e161'::uuid, :patient, :org, :facility,
                  'OUTPATIENT', 'FINISHED', now() - interval '1 day', now() - interval '23 hours',
                  'SYNTHETIC', 'syn-er-001-prior-opd')
                on conflict (tenant_id, encounter_id) do nothing
                """).param("tenant", TENANT_ID).param("patient", patientId).param("org", ORGANIZATION_ID)
                .param("facility", FACILITY_ID).update();
        jdbc.sql("""
                insert into encounter_domain_switch(
                  tenant_id, domain_switch_id, patient_id, from_encounter_id, to_encounter_id,
                  from_domain, to_domain, reason, switched_at, switched_by)
                values (:tenant, '018f0000-0000-7000-8000-00000000e162'::uuid, :patient,
                  '018f0000-0000-7000-8000-00000000e161'::uuid, :encounter,
                  'OUTPATIENT', 'EMERGENCY', '胸痛伴低血压，门诊立即升级急诊抢救流程',
                  now() - interval '49 minutes', :user)
                on conflict (tenant_id, domain_switch_id) do nothing
                """).param("tenant", TENANT_ID).param("patient", patientId).param("encounter", encounterId)
                .param("user", USER_ID).update();
    }

    private void upsertSpecialtyReferencePatients() {
        jdbc.sql("""
                update patient
                set sex_code = 'F', updated_at = now(), row_version = row_version + 1
                where tenant_id = :tenant
                  and patient_id = '018f0000-0000-7000-8000-000000000001'::uuid
                  and sex_code <> 'F'
                """).param("tenant", TENANT_ID).update();
        jdbc.sql("""
                insert into patient(
                  tenant_id, patient_id, display_name, sex_code, birth_date, status, row_version)
                values (:tenant, '018f0000-0000-7000-8000-000000000006'::uuid,
                  '周婉宁',
                  'F', date '1990-05-18', 'ACTIVE', 1)
                on conflict (tenant_id, patient_id) do update
                set display_name = excluded.display_name, updated_at = now(),
                    row_version = patient.row_version + 1
                where patient.display_name is distinct from excluded.display_name
                """).param("tenant", TENANT_ID).update();
    }

    private void upsertAgentCatalog() {
        jdbc.sql("""
                insert into agent_registry(
                  tenant_id, agent_registry_id, agent_code, agent_name, agent_version, status)
                select :tenant, seed.agent_registry_id::uuid, seed.agent_code,
                  seed.agent_name, '1.0.0', 'ACTIVE'
                from (values
                  ('018f0000-0000-7000-8000-00000000ee01', 'ENCOUNTER_SUMMARIZER', '就诊摘要医助团队'),
                  ('018f0000-0000-7000-8000-00000000ee02', 'DOCUMENT_DRAFTER', '文书起草医助团队'),
                  ('018f0000-0000-7000-8000-00000000ee03', 'RECORD_QC', '病历质控医助团队'),
                  ('018f0000-0000-7000-8000-00000000ee04', 'RESULT_FOLLOWUP_COORDINATOR', '结果闭环医助团队'),
                  ('018f0000-0000-7000-8000-00000000ee05', 'CARE_COORDINATOR', '诊疗协同医助团队')
                ) as seed(agent_registry_id, agent_code, agent_name)
                on conflict (tenant_id, agent_registry_id) do update
                set status = 'ACTIVE', updated_at = now()
                where agent_registry.status is distinct from 'ACTIVE'
                """).param("tenant", TENANT_ID).update();
    }

    private void upsertAiPlatformCatalog() {
        jdbc.sql("""
                insert into model_deployment(
                  tenant_id, model_deployment_id, model_code, provider_code, display_name,
                  residency_policy, endpoint_url, status, evaluation_status, row_version)
                select :tenant, seed.model_deployment_id::uuid, seed.model_code, seed.provider_code,
                  seed.display_name, seed.residency_policy, seed.endpoint_url, 'ACTIVE', 'APPROVED', 1
                from (values
                  ('018f0000-0000-7000-8000-00000000f001', 'DEEPSEEK-V3-CLINICAL-LOCAL', 'DEEPSEEK',
                   'DeepSeek V3 临床本地路由', 'ON_PREM_ONLY', null),
                  ('018f0000-0000-7000-8000-00000000f002', 'DEEPSEEK-R1-REASONING-LOCAL', 'DEEPSEEK',
                   'DeepSeek R1 临床推理路由', 'ON_PREM_ONLY', null),
                  ('018f0000-0000-7000-8000-00000000f003', 'QWEN3-EMBEDDING-LOCAL', 'QWEN',
                   'Qwen3 临床检索向量模型', 'ON_PREM_ONLY', null),
                  ('018f0000-0000-7000-8000-00000000f004', 'DETERMINISTIC-CLINICAL-FAKE', 'OPENEMR2026',
                   '确定性临床验收模型', 'LOCAL_PREFERRED', null)
                ) as seed(model_deployment_id, model_code, provider_code, display_name, residency_policy, endpoint_url)
                on conflict (tenant_id, model_code) do update
                set display_name = excluded.display_name, status = 'ACTIVE', evaluation_status = 'APPROVED',
                    updated_at = now(), row_version = model_deployment.row_version + 1
                where model_deployment.display_name is distinct from excluded.display_name
                   or model_deployment.status is distinct from 'ACTIVE'
                   or model_deployment.evaluation_status is distinct from 'APPROVED'
                """).param("tenant", TENANT_ID).update();

        jdbc.sql("""
                insert into skill_registry(
                  tenant_id, skill_registry_id, skill_code, skill_name, skill_version, status)
                select :tenant, seed.skill_registry_id::uuid, seed.skill_code, seed.skill_name,
                  '1.0.0', 'ACTIVE'
                from (values
                  ('018f0000-0000-7000-8000-00000000f101', 'CONTEXT_LEASE_GUARD', '上下文租约校验'),
                  ('018f0000-0000-7000-8000-00000000f102', 'PATIENT_TIMELINE_RETRIEVAL', '患者时间线检索'),
                  ('018f0000-0000-7000-8000-00000000f103', 'CLINICAL_FACT_SUMMARY', '临床事实摘要'),
                  ('018f0000-0000-7000-8000-00000000f104', 'CLINICAL_DOCUMENT_DRAFT', '临床文书候选起草'),
                  ('018f0000-0000-7000-8000-00000000f105', 'DOCUMENT_CONSISTENCY_REVIEW', '文书一致性审阅'),
                  ('018f0000-0000-7000-8000-00000000f106', 'CRITICAL_RESULT_CONTEXT', '危急值上下文核对'),
                  ('018f0000-0000-7000-8000-00000000f107', 'FOLLOWUP_TASK_PLANNING', '随访任务候选规划'),
                  ('018f0000-0000-7000-8000-00000000f108', 'CONSULT_BRIEF_PREPARATION', '会诊资料候选准备'),
                  ('018f0000-0000-7000-8000-00000000f109', 'MEDICATION_RISK_EXPLANATION', '用药风险解释'),
                  ('018f0000-0000-7000-8000-00000000f10a', 'MINIMUM_NECESSARY_REDACTION', '最小必要数据脱敏'),
                  ('018f0000-0000-7000-8000-00000000f10b', 'SOURCE_REFERENCE_CITATION', '可定位来源引用'),
                  ('018f0000-0000-7000-8000-00000000f10c', 'CANDIDATE_BOUNDARY_VALIDATION', '候选结果边界校验')
                ) as seed(skill_registry_id, skill_code, skill_name)
                on conflict (tenant_id, skill_code) do update
                set status = 'ACTIVE', updated_at = now()
                where skill_registry.status is distinct from 'ACTIVE'
                """).param("tenant", TENANT_ID).update();

        jdbc.sql("""
                insert into tool_registry(
                  tenant_id, tool_registry_id, tool_code, tool_name, tool_version, tool_type, status)
                select :tenant, seed.tool_registry_id::uuid, seed.tool_code, seed.tool_name,
                  '1.0.0', seed.tool_type, 'ACTIVE'
                from (values
                  ('018f0000-0000-7000-8000-00000000f201', 'PATIENT_SUMMARY_READ', '患者概要只读工具', 'DATABASE_QUERY'),
                  ('018f0000-0000-7000-8000-00000000f202', 'ENCOUNTER_TIMELINE_READ', '就诊时间线只读工具', 'DATABASE_QUERY'),
                  ('018f0000-0000-7000-8000-00000000f203', 'DOCUMENT_VERSION_READ', '病历版本只读工具', 'DATABASE_QUERY'),
                  ('018f0000-0000-7000-8000-00000000f204', 'RESULT_READ', '检查检验结果只读工具', 'DATABASE_QUERY'),
                  ('018f0000-0000-7000-8000-00000000f205', 'CRITICAL_VALUE_READ', '危急值闭环只读工具', 'DATABASE_QUERY'),
                  ('018f0000-0000-7000-8000-00000000f206', 'ORDER_READ', '医嘱与处方只读工具', 'DATABASE_QUERY'),
                  ('018f0000-0000-7000-8000-00000000f207', 'CLINICAL_TASK_READ', '临床任务只读工具', 'DATABASE_QUERY'),
                  ('018f0000-0000-7000-8000-00000000f208', 'CONSULTATION_READ', '会诊协同只读工具', 'DATABASE_QUERY'),
                  ('018f0000-0000-7000-8000-00000000f209', 'CARE_PLAN_READ', '诊疗计划只读工具', 'DATABASE_QUERY'),
                  ('018f0000-0000-7000-8000-00000000f20a', 'DOCUMENT_TEMPLATE_READ', '文书模板只读工具', 'DATABASE_QUERY'),
                  ('018f0000-0000-7000-8000-00000000f20b', 'CLINICAL_RULE_EVALUATE', '临床硬规则只读评估', 'FUNCTION'),
                  ('018f0000-0000-7000-8000-00000000f20c', 'AGENT_EVIDENCE_APPEND', '医助证据链追加工具', 'FUNCTION')
                ) as seed(tool_registry_id, tool_code, tool_name, tool_type)
                on conflict (tenant_id, tool_code) do update
                set status = 'ACTIVE', updated_at = now()
                where tool_registry.status is distinct from 'ACTIVE'
                """).param("tenant", TENANT_ID).update();

        jdbc.sql("""
                insert into agent_run_budget(
                  tenant_id, budget_id, budget_code, budget_name, max_tokens,
                  max_duration_seconds, status)
                select :tenant, seed.budget_id::uuid, seed.budget_code, seed.budget_name,
                  seed.max_tokens, seed.max_duration_seconds, 'ACTIVE'
                from (values
                  ('018f0000-0000-7000-8000-00000000f301', 'BUDGET_ENCOUNTER_SUMMARIZER', '就诊摘要医助单次处理上限', 16000::bigint, 90),
                  ('018f0000-0000-7000-8000-00000000f302', 'BUDGET_DOCUMENT_DRAFTER', '文书起草医助单次处理上限', 22000::bigint, 120),
                  ('018f0000-0000-7000-8000-00000000f303', 'BUDGET_RECORD_QC', '病历质控医助单次处理上限', 16000::bigint, 90),
                  ('018f0000-0000-7000-8000-00000000f304', 'BUDGET_RESULT_FOLLOWUP', '结果闭环医助单次处理上限', 24000::bigint, 120),
                  ('018f0000-0000-7000-8000-00000000f305', 'BUDGET_CARE_COORDINATOR', '诊疗协同医助单次处理上限', 22000::bigint, 120)
                ) as seed(budget_id, budget_code, budget_name, max_tokens, max_duration_seconds)
                on conflict (tenant_id, budget_code) do update
                set budget_name = excluded.budget_name, status = 'ACTIVE', updated_at = now()
                where agent_run_budget.budget_name is distinct from excluded.budget_name
                   or agent_run_budget.status is distinct from 'ACTIVE'
                """).param("tenant", TENANT_ID).update();

        jdbc.sql("""
                insert into model_evaluation(
                  tenant_id, model_evaluation_id, model_deployment_id, eval_name, score,
                  threshold, status, evaluated_at, evaluated_by)
                select :tenant, seed.model_evaluation_id::uuid, seed.model_deployment_id::uuid,
                  seed.eval_name, seed.score, seed.threshold,
                  case when seed.score >= seed.threshold then 'PASSED' else 'FAILED' end,
                  now() - seed.age_days * interval '1 day', :actor
                from (values
                  ('018f0000-0000-7000-8000-00000000f401', '018f0000-0000-7000-8000-00000000f001', '临床事实一致性与拒答门禁', 0.9730::numeric, 0.9500::numeric, 3),
                  ('018f0000-0000-7000-8000-00000000f402', '018f0000-0000-7000-8000-00000000f002', '复杂推理可追溯性门禁', 0.9620::numeric, 0.9500::numeric, 2),
                  ('018f0000-0000-7000-8000-00000000f403', '018f0000-0000-7000-8000-00000000f003', '医疗语义检索召回率门禁', 0.9810::numeric, 0.9600::numeric, 1),
                  ('018f0000-0000-7000-8000-00000000f404', '018f0000-0000-7000-8000-00000000f004', '确定性验收回归集', 1.0000::numeric, 1.0000::numeric, 0)
                ) as seed(model_evaluation_id, model_deployment_id, eval_name, score, threshold, age_days)
                on conflict (tenant_id, model_evaluation_id) do nothing
                """).param("tenant", TENANT_ID).param("actor", USER_ID).update();

        jdbc.sql("""
                insert into agent_dependency(
                  tenant_id, agent_dependency_id, agent_registry_id, dependency_type, dependency_code)
                select :tenant, seed.agent_dependency_id::uuid, seed.agent_registry_id::uuid,
                  seed.dependency_type, seed.dependency_code
                from (values
                  ('018f0000-0000-7000-8000-00000000f501', '018f0000-0000-7000-8000-00000000ee01', 'SKILL', 'CLINICAL_FACT_SUMMARY'),
                  ('018f0000-0000-7000-8000-00000000f502', '018f0000-0000-7000-8000-00000000ee01', 'TOOL', 'ENCOUNTER_TIMELINE_READ'),
                  ('018f0000-0000-7000-8000-00000000f503', '018f0000-0000-7000-8000-00000000ee02', 'SKILL', 'CLINICAL_DOCUMENT_DRAFT'),
                  ('018f0000-0000-7000-8000-00000000f504', '018f0000-0000-7000-8000-00000000ee02', 'TOOL', 'DOCUMENT_TEMPLATE_READ'),
                  ('018f0000-0000-7000-8000-00000000f505', '018f0000-0000-7000-8000-00000000ee03', 'SKILL', 'DOCUMENT_CONSISTENCY_REVIEW'),
                  ('018f0000-0000-7000-8000-00000000f506', '018f0000-0000-7000-8000-00000000ee03', 'TOOL', 'CLINICAL_RULE_EVALUATE'),
                  ('018f0000-0000-7000-8000-00000000f507', '018f0000-0000-7000-8000-00000000ee04', 'SKILL', 'CRITICAL_RESULT_CONTEXT'),
                  ('018f0000-0000-7000-8000-00000000f508', '018f0000-0000-7000-8000-00000000ee04', 'TOOL', 'CRITICAL_VALUE_READ'),
                  ('018f0000-0000-7000-8000-00000000f509', '018f0000-0000-7000-8000-00000000ee05', 'SKILL', 'CONSULT_BRIEF_PREPARATION'),
                  ('018f0000-0000-7000-8000-00000000f50a', '018f0000-0000-7000-8000-00000000ee05', 'TOOL', 'CONSULTATION_READ')
                ) as seed(agent_dependency_id, agent_registry_id, dependency_type, dependency_code)
                on conflict (tenant_id, agent_registry_id, dependency_type, dependency_code) do nothing
                """).param("tenant", TENANT_ID).update();

        jdbc.sql("""
                insert into agent_run_budget_consumption(
                  tenant_id, consumption_id, budget_id, run_id, tokens_consumed,
                  duration_seconds, recorded_by, recorded_at)
                select :tenant, seed.consumption_id::uuid, seed.budget_id::uuid, seed.run_id::uuid,
                  seed.tokens_consumed, seed.duration_seconds, :actor,
                  now() - seed.age_hours * interval '1 hour'
                from (values
                  ('018f0000-0000-7000-8000-00000000f601', '018f0000-0000-7000-8000-00000000f301', '018f0000-0000-7000-8000-00000000f701', 4280::bigint, 18::bigint, 8),
                  ('018f0000-0000-7000-8000-00000000f602', '018f0000-0000-7000-8000-00000000f302', '018f0000-0000-7000-8000-00000000f702', 7350::bigint, 34::bigint, 6),
                  ('018f0000-0000-7000-8000-00000000f603', '018f0000-0000-7000-8000-00000000f304', '018f0000-0000-7000-8000-00000000f703', 5190::bigint, 22::bigint, 3)
                ) as seed(consumption_id, budget_id, run_id, tokens_consumed, duration_seconds, age_hours)
                on conflict (tenant_id, consumption_id) do nothing
                """).param("tenant", TENANT_ID).param("actor", USER_ID).update();
    }

    private void upsertAiAgentConfigurationFixtures() {
        jdbc.sql("""
                update config_item
                set payload = payload || jsonb_build_object(
                  'proactive_level', 'REMIND_ONLY',
                  'allowed_sources', jsonb_build_array('DOCUMENT_VERSION', 'OBSERVATION', 'ORDER', 'RESULT', 'RULE'),
                  'model_policy', 'DEEPSEEK_LOCAL_FIRST_WITH_DETERMINISTIC_FALLBACK',
                  'rate_limit', 10,
                  'approval_required', true,
                  'main_agent_count', 5,
                  'child_agent_count', 33),
                  updated_at = now()
                where tenant_id = :tenant and config_type = 'AI_ASSISTANT_POLICY'
                  and config_key = 'syn-xiaonan-policy-v1'
                  and not jsonb_exists(payload, 'main_agent_count')
                """).param("tenant", TENANT_ID).update();
        jdbc.sql("""
                update config_item
                set payload = payload || jsonb_build_object(
                  'agents', jsonb_build_array(
                    'ENCOUNTER_SUMMARIZER@1.0.0', 'DOCUMENT_DRAFTER@1.0.0', 'RECORD_QC@1.0.0',
                    'RESULT_FOLLOWUP_COORDINATOR@1.0.0', 'CARE_COORDINATOR@1.0.0'),
                  'skills', jsonb_build_array('CONTEXT_LEASE_GUARD@1.0.0', 'SOURCE_REFERENCE_CITATION@1.0.0', 'CANDIDATE_BOUNDARY_VALIDATION@1.0.0'),
                  'tools', jsonb_build_array('ENCOUNTER_TIMELINE_READ@1.0.0', 'DOCUMENT_VERSION_READ@1.0.0', 'AGENT_EVIDENCE_APPEND@1.0.0'),
                  'budget_tokens', 24000,
                  'stop_conditions', '租约失效；患者或就诊切换；超预算；来源不可定位；硬规则阻断',
                  'compensation', '停止未执行节点，保留事件证据，转人工复核'),
                  updated_at = now()
                where tenant_id = :tenant and config_type = 'AGENT_COMPOSITION'
                  and config_key = 'syn-agent-team-v1'
                  and not jsonb_exists(payload, 'agents')
                """).param("tenant", TENANT_ID).update();
        jdbc.sql("""
                insert into config_item(
                  tenant_id, config_id, config_type, config_key, display_name, payload,
                  status, row_version, schema_version, validation_state, validation_errors,
                  approval_state, created_by)
                select :tenant, seed.config_id::uuid, 'AGENT_EVAL', seed.config_key, seed.display_name,
                  jsonb_build_object(
                    'schema_version', 1,
                    'description', seed.description,
                    'dataset_version', seed.dataset_version,
                    'case_count', seed.case_count,
                    'pass_threshold', seed.pass_threshold,
                    'red_team_profile', '越权上下文、Prompt 注入、无来源临床结论、自动临床副作用、敏感数据外泄',
                    'target_agent', seed.target_agent,
                    'measured_score', seed.measured_score,
                    'release_gate', case when seed.measured_score >= seed.pass_threshold then 'PASSED' else 'BLOCKED' end,
                    'environment', 'dev-synthetic'),
                  'DRAFT', 1, 1, 'VALID', '[]'::jsonb, 'DRAFT', :author
                from (values
                  ('018f0000-0000-7000-8000-00000000f801', 'eval-encounter-summarizer-v1', '就诊摘要医助发布审核', 'ENCOUNTER_SUMMARIZER', '核验事实一致性、时线完整性和来源覆盖。', 'agent-encounter-golden-v1', 120, 0.9500::numeric, 0.9780::numeric),
                  ('018f0000-0000-7000-8000-00000000f802', 'eval-document-drafter-v1', '文书起草医助发布审核', 'DOCUMENT_DRAFTER', '核验模板完整性、来源对齐和未确认项标注。', 'agent-document-golden-v1', 160, 0.9600::numeric, 0.9720::numeric),
                  ('018f0000-0000-7000-8000-00000000f803', 'eval-record-qc-v1', '病历质控医助发布审核', 'RECORD_QC', '核验硬规则优先、语义缺陷准确性和低打扰率。', 'agent-record-qc-golden-v1', 140, 0.9500::numeric, 0.9690::numeric),
                  ('018f0000-0000-7000-8000-00000000f804', 'eval-result-followup-v1', '结果闭环医助发布审核', 'RESULT_FOLLOWUP_COORDINATOR', '核验危急值不降级、结果版本可追溯和闭环责任。', 'agent-result-golden-v1', 180, 0.9800::numeric, 0.9860::numeric),
                  ('018f0000-0000-7000-8000-00000000f805', 'eval-care-coordinator-v1', '诊疗协同医助发布审核', 'CARE_COORDINATOR', '核验职责范围、任务去重、责任人与截止时间完整性。', 'agent-care-golden-v1', 130, 0.9500::numeric, 0.9710::numeric)
                ) as seed(config_id, config_key, display_name, target_agent, description,
                  dataset_version, case_count, pass_threshold, measured_score)
                on conflict (tenant_id, config_id) do nothing
                """).param("tenant", TENANT_ID).param("author", USER_ID).update();
    }

    private void upsertConfigurationFixtures() {
        jdbc.sql("""
                insert into config_item(
                  tenant_id, config_id, config_type, config_key, display_name, payload,
                  status, row_version, schema_version, validation_state, validation_errors,
                  approval_state, created_by)
                select :tenant, seed.config_id::uuid, seed.config_type, seed.config_key,
                  seed.display_name,
                  jsonb_build_object(
                    'schema_version', case when seed.config_type in ('WORKFLOW', 'FORM_TEMPLATE', 'RULE', 'SCOPE') then 2 else 1 end,
                    'description', seed.description,
                    'environment', 'dev-synthetic',
                    'owner', 'OpenEMR2026 验收组',
                    'effective_scope', jsonb_build_array('合成医院', '全院区', '验收角色'),
                    'controls', jsonb_build_array('双人复核', '审计留痕', '失败关闭', '可回退'),
                    'evidence', jsonb_build_object(
                      'dataset', 'synthetic-clinical-golden-v1',
                      'case_count', 12,
                      'last_verified', '2026-08-25'))
                  || case seed.config_type
                    when 'WORKFLOW' then jsonb_build_object(
                      'nodes', jsonb_build_array(
                        jsonb_build_object('id','start','name','发起申请','type','START','owner','经治医生','minutes',15),
                        jsonb_build_object('id','receive','name','科室接收','type','TASK','owner','目标科室','minutes',30),
                        jsonb_build_object('id','opinion','name','专家意见','type','TASK','owner','会诊专家','minutes',120),
                        jsonb_build_object('id','sign','name','数字签署','type','SIGN','owner','会诊专家','minutes',20,'protected',true),
                        jsonb_build_object('id','audit','name','审计留痕','type','AUDIT','owner','系统','minutes',1,'protected',true),
                        jsonb_build_object('id','complete','name','完成','type','END','owner','系统','minutes',1,'terminal',true,'protected',true)),
                      'edges', jsonb_build_array(
                        jsonb_build_object('from','start','to','receive','condition','申请已提交'),
                        jsonb_build_object('from','receive','to','opinion','condition','科室接收'),
                        jsonb_build_object('from','opinion','to','sign','condition','意见完成'),
                        jsonb_build_object('from','sign','to','audit','condition','签名有效'),
                        jsonb_build_object('from','audit','to','complete','condition','审计成功'),
                        jsonb_build_object('from','receive','to','start','condition','资料不全','compensation',true)),
                      'protected_nodes', jsonb_build_array('sign', 'audit', 'complete'),
                      'timeout_policy', '30 分钟提醒，120 分钟升级科主任，240 分钟升级医务处',
                      'synthetic_case', jsonb_build_object('case_id','SYN-CONSULT-20260826-01','patient','赵明远（合成）'))
                    when 'FORM_TEMPLATE' then jsonb_build_object(
                      'groups', jsonb_build_array(jsonb_build_object('id','history','name','病史采集','columns',2),jsonb_build_object('id','assessment','name','评估与计划','columns',2)),
                      'fields', jsonb_build_array(
                        jsonb_build_object('id','chief_complaint','label','主诉','type','TEXTAREA','group','history','required',true,'terminology','SNOMED-CT'),
                        jsonb_build_object('id','pain_score','label','疼痛评分','type','NUMBER','group','history','required',true,'validation','0 <= value <= 10'),
                        jsonb_build_object('id','risk_level','label','胸痛风险分层','type','CALCULATED','group','assessment','required',true,'protected',true,'calculation','pain_score >= 7 ? HIGH : MEDIUM'),
                        jsonb_build_object('id','diagnosis','label','诊断','type','CODE','group','assessment','required',true,'protected',true,'terminology','ICD-10-CN'),
                        jsonb_build_object('id','signature','label','医生签名','type','SIGNATURE','group','assessment','required',true,'protected',true)),
                      'terminology_mapping', jsonb_build_array(jsonb_build_object('field','diagnosis','system','ICD-10-CN'),jsonb_build_object('field','chief_complaint','system','SNOMED-CT')),
                      'print_template', 'A4-门诊病历-v2',
                      'sample_values', jsonb_build_object('chief_complaint','胸痛 2 小时','pain_score',8,'diagnosis','I20.0 不稳定型心绞痛'))
                    when 'RULE' then jsonb_build_object(
                      'conditions', jsonb_build_array('年龄<14', '药品类型=处方', '体重已记录'),
                      'actions', jsonb_build_array('校验体重剂量', '阻断超范围处方'),
                      'rule_layer', 'MIXED',
                      'rules', jsonb_build_array(
                        jsonb_build_object('id','allergy-block','name','严重过敏处方阻断','layer','PLATFORM_HARD','priority',1000,'condition','严重过敏且成分命中','action','阻断处方并要求替代药','evidence','国家药品不良反应监测规范','exception','禁止例外','enabled',true),
                        jsonb_build_object('id','pediatric-dose','name','儿科体重剂量校验','layer','INSTITUTION_HARD','priority',800,'condition','年龄<14 且已录入体重','action','超出 mg/kg 范围时阻断','evidence','院内儿科用药目录 2026.2','exception','药师与上级医师双签','enabled',true),
                        jsonb_build_object('id','consult-timeout','name','会诊超时升级','layer','REMINDER','priority',500,'condition','会诊等待>=120分钟','action','提醒科主任并升级任务','evidence','医疗核心制度','exception','急救处理中可延后','enabled',true),
                        jsonb_build_object('id','ai-summary','name','AI 病情摘要建议','layer','AI_ADVICE','priority',100,'condition','资料完整度>=80%','action','生成带来源的摘要候选','evidence','clinical-ai-golden-v1','exception','仅供人工确认','enabled',true)),
                      'sample_case', jsonb_build_object('case_id','SYN-RULE-20260826-01','age',6,'weight_kg',20,'allergy','青霉素严重过敏','order','阿莫西林克拉维酸钾'))
                    when 'SCOPE' then jsonb_build_object(
                      'roles', jsonb_build_array('作者', '审批人', '跨科医生'),
                      'data_scopes', jsonb_build_array('本科就诊', '授权患者', '脱敏汇总'),
                      'permissions', jsonb_build_array(
                        jsonb_build_object('role','经治医生','resource','病历草稿','action','读写','scope','本科患者','effect','ALLOW','temporary_hours',0,'sod','签署人不能批准本人更正'),
                        jsonb_build_object('role','会诊医生','resource','病历全文','action','只读','scope','会诊授权患者','effect','ALLOW','temporary_hours',4,'sod','禁止导出'),
                        jsonb_build_object('role','会诊医生','resource','批量导出','action','导出','scope','全部患者','effect','DENY','temporary_hours',0,'sod','保护性拒绝优先'),
                        jsonb_build_object('role','护士长','resource','护理记录','action','审核','scope','本病区','effect','ALLOW','temporary_hours',0,'sod','作者与审核人分离')),
                      'separation_of_duties', '作者!=审批人；跨科医生只读',
                      'temporary_grant_hours', 4)
                    when 'MASTER_DATA' then jsonb_build_object(
                      'code_system', 'OPENEMR2026-HOSPITAL-MASTER',
                      'hierarchy', jsonb_build_array('医院', '院区', '科室', '病区', '床位'),
                      'effective_period', '2026-01-01/2099-12-31',
                      'import_policy', '编码冲突阻断；已引用数据仅允许停用')
                    when 'PARAMETER' then jsonb_build_object(
                      'value_type', 'OBJECT', 'scope', 'ORGANIZATION',
                      'inheritance', '机构默认，院区可以在安全基线内收紧',
                      'configured_value', '临床系统参数基线 v1',
                      'secret_reference', 'env://OPENEMR2026_SYSTEM_PARAMETER_BASELINE',
                      'effective_at', '2026-08-25T00:00:00+08:00')
                    when 'JOB' then jsonb_build_object(
                      'schedule', '0 */5 * * * *', 'batch_size', 100,
                      'retry_policy', '只重试失败通知；1m/5m/15m；最多 3 次',
                      'reconciliation_rule', '通知发送、回执、失败和补偿总数必须相等',
                      'notification_channels', jsonb_build_array('站内信', '短信', '邮件', 'Webhook'),
                      'channel_owner', '信息中心运维组')
                    else '{}'::jsonb
                  end,
                  'DRAFT', 1, 1, 'NOT_VALIDATED', '[]'::jsonb, 'DRAFT', :author
                from (values
                  ('018f0000-0000-7000-8000-00000000c101', 'WORKFLOW', 'syn-workflow-closed-loop-v1', '门急住全程闭环流程', '覆盖接诊、诊疗、交接、归档与异常补偿的合成流程。'),
                  ('018f0000-0000-7000-8000-00000000c102', 'FORM_TEMPLATE', 'syn-medical-record-v1', '复杂病历结构化模板', '包含主诉、现病史、系统回顾、查体、诊断依据与计划。'),
                  ('018f0000-0000-7000-8000-00000000c103', 'RULE', 'syn-clinical-safety-v1', '临床安全与时限规则', '覆盖过敏、剂量、危急值、超时与会诊升级规则。'),
                  ('018f0000-0000-7000-8000-00000000c104', 'SCOPE', 'syn-role-scope-v1', '院科患者关系数据范围', '按机构、岗位、患者关系和临时授权组合控制。'),
                  ('018f0000-0000-7000-8000-00000000c105', 'AGENT_COMPOSITION', 'syn-agent-team-v1', 'AI医助小南团队编排', '六类医助按诊疗场景协同处理，临床写入均需医生确认。'),
                  ('018f0000-0000-7000-8000-00000000c106', 'AGENT_CONTEXT', 'syn-agent-context-v1', '最小必要临床上下文', '绑定患者、就诊、任务、来源和有效期，切换后立即失效。'),
                  ('018f0000-0000-7000-8000-00000000c107', 'AGENT_EVAL', 'syn-agent-eval-v1', '临床医助发布评测集', '包含事实一致性、引用覆盖、拒答和对抗测试样本。'),
                  ('018f0000-0000-7000-8000-00000000c108', 'AI_ASSISTANT_POLICY', 'syn-xiaonan-policy-v1', 'AI医助小南候选策略', '限定数据源、模型、主动级别、限频和动作审批。'),
                  ('018f0000-0000-7000-8000-00000000c109', 'CONFIG_RELEASE', 'syn-config-release-v1', '配置灰度发布批次', '包含差异、验证证据、灰度范围、停止条件和回退点。'),
                  ('018f0000-0000-7000-8000-00000000c110', 'CONFIG_UPGRADE', 'syn-config-upgrade-v1', '配置包升级预演', '覆盖兼容性检查、冲突决议、迁移预演与恢复校验。'),
                  ('018f0000-0000-7000-8000-00000000c111', 'MASTER_DATA', 'hospital-master-data-v1', '医院主数据基线', '包含机构、科室、病区、床位、术语和值集的有效期。'),
                  ('018f0000-0000-7000-8000-00000000c112', 'PARAMETER', 'system-parameters-v1', '临床系统参数基线', '记录作用域、继承、敏感引用、生效时间和回退值。'),
                  ('018f0000-0000-7000-8000-00000000c113', 'JOB', 'notification-job-v1', '危急值通知对账任务', '记录批次、进度、部分成功、失败项重试和 Outbox 对账。'),
                  ('018f0000-0000-7000-8000-00000000c114', 'BACKUP', 'syn-backup-drill-v1', '合成库备份恢复演练', '包含 checksum、RPO/RTO、恢复步骤和完整性报告。'),
                  ('018f0000-0000-7000-8000-00000000c115', 'INSTALL', 'syn-install-healthcheck-v1', '首次安装健康检查', '验证数据库、OIDC、消息、存储和合成数据导入。'),
                  ('018f0000-0000-7000-8000-00000000c116', 'OPERATION', 'syn-operations-v1', '生产运行与停机续运预案', '展示服务健康、事件、维护窗、积压与恢复动作。'),
                  ('018f0000-0000-7000-8000-00000000c117', 'RELEASE_GATE', 'syn-release-gate-v1', 'OpenEMR2026 发布门禁', '聚合契约、迁移、测试、安全、备份和回滚证据。')
                ) as seed(config_id, config_type, config_key, display_name, description)
                on conflict (tenant_id, config_id) do update
                set display_name = excluded.display_name,
                    payload = excluded.payload,
                    updated_at = now(),
                    row_version = config_item.row_version + 1
                where config_item.display_name is distinct from excluded.display_name
                   or config_item.payload is distinct from excluded.payload
                """).param("tenant", TENANT_ID).param("author", USER_ID).update();
        jdbc.sql("""
                insert into config_item(
                  tenant_id, config_id, config_type, config_key, display_name, payload,
                  status, row_version, schema_version, validation_state, validation_errors,
                  approval_state, created_by)
                select :tenant, seed.config_id::uuid, 'PARAMETER', seed.config_key,
                  seed.display_name,
                  jsonb_build_object(
                    'schema_version', 1, 'description', seed.description,
                    'value_type', seed.value_type, 'scope', seed.scope,
                    'inheritance', seed.inheritance,
                    'configured_value', seed.configured_value,
                    'secret_reference', seed.secret_reference,
                    'effective_at', '2026-08-25T00:00:00+08:00'),
                  'DRAFT', 1, 1, 'NOT_VALIDATED', '[]'::jsonb, 'DRAFT', :author
                from (values
                  ('018f0000-0000-7000-8000-00000000c211', 'syn-admin-session-v1', '管理会话时长',
                    '高权管理会话闲置超时', 'INTEGER_MINUTES', 'ORGANIZATION',
                    '全局默认，机构可缩短', '15 分钟闲置超时；8 小时绝对时限', 'env://OPENEMR2026_ADMIN_SESSION_MINUTES'),
                  ('018f0000-0000-7000-8000-00000000c212', 'syn-record-autosave-v1', '病历自动保存间隔',
                    '结构化病历草稿自动保存间隔', 'INTEGER_SECONDS', 'FACILITY',
                    '院区覆盖机构默认值', '10 秒', 'env://OPENEMR2026_RECORD_AUTOSAVE_SECONDS'),
                  ('018f0000-0000-7000-8000-00000000c213', 'syn-archive-retention-v1', '住院病历保管年限',
                    '住院病案长期保存保护下限', 'INTEGER_YEARS', 'GLOBAL',
                    '机构不得向下覆盖', '30 年', 'env://OPENEMR2026_ARCHIVE_RETENTION_YEARS'),
                  ('018f0000-0000-7000-8000-00000000c214', 'syn-research-feature-v1', '科研统计模块开关',
                    '机构级科研统计功能灰度开关', 'BOOLEAN', 'ORGANIZATION',
                    '科室继承机构值', '机构级灰度启用', 'env://OPENEMR2026_RESEARCH_ENABLED'),
                  ('018f0000-0000-7000-8000-00000000c215', 'syn-pacs-timeout-v1', 'PACS 调阅超时',
                    '影像调阅超时灰度参数', 'INTEGER_MILLISECONDS', 'FACILITY',
                    '院区覆盖机构默认值', '平台 8000ms -> 机构 6000ms -> 本部院区 5000ms', 'env://OPENEMR2026_PACS_TIMEOUT_MS'),
                  ('018f0000-0000-7000-8000-00000000c216', 'syn-auth-identity-provider-v1', '统一身份源',
                    '生产环境统一身份认证源', 'STRING', 'GLOBAL',
                    '生产启用 OIDC；开发验收使用数据库测试凭据', '江城大学统一身份平台 · OIDC', 'env://OPENEMR2026_OIDC_ISSUER'),
                  ('018f0000-0000-7000-8000-00000000c217', 'syn-auth-flow-v1', '授权模式',
                    '浏览器登录授权模式', 'STRING', 'GLOBAL',
                    '客户端不得保存用户密码', 'Authorization Code + PKCE', 'env://OPENEMR2026_OIDC_CLIENT_ID'),
                  ('018f0000-0000-7000-8000-00000000c218', 'syn-auth-mfa-policy-v1', '多因素认证',
                    '高风险场景多因素认证要求', 'STRING', 'ORGANIZATION',
                    '机构只能扩大强制范围', '管理员、院外访问和高风险操作强制 MFA', 'env://OPENEMR2026_MFA_POLICY'),
                  ('018f0000-0000-7000-8000-00000000c219', 'syn-auth-lockout-policy-v1', '失败锁定',
                    '连续认证失败锁定策略', 'STRING', 'GLOBAL',
                    '全局安全基线', '连续 5 次失败锁定 15 分钟', 'env://OPENEMR2026_AUTH_LOCKOUT_POLICY'),
                  ('018f0000-0000-7000-8000-00000000c220', 'syn-auth-emergency-policy-v1', '紧急访问',
                    '紧急访问时限与事后复核要求', 'STRING', 'GLOBAL',
                    '机构只能缩短时限', '最小范围 · 最长 60 分钟 · 强制事后复核', 'env://OPENEMR2026_EMERGENCY_ACCESS_POLICY'),
                  ('018f0000-0000-7000-8000-00000000c230', 'syn-auth-password-policy-v1', '口令强度基线',
                    '开发凭据和应急本地账户的口令复杂度', 'STRING', 'GLOBAL',
                    '生产统一身份源策略优先', '至少 12 位，包含数字、大小写字母和特殊字符', 'env://OPENEMR2026_PASSWORD_POLICY'),
                  ('018f0000-0000-7000-8000-00000000c231', 'syn-auth-concurrent-session-v1', '并发会话限制',
                    '同一管理账号允许的有效会话上限', 'INTEGER', 'ORGANIZATION',
                    '机构可设置更严格上限', '最多 3 个并发会话', 'env://OPENEMR2026_MAX_CONCURRENT_SESSIONS'),
                  ('018f0000-0000-7000-8000-00000000c232', 'syn-auth-risk-reauth-v1', '高风险操作再认证',
                    '导出、授权和安全配置变更前重新认证', 'STRING', 'GLOBAL',
                    '所有机构必须启用', '授权、批量导出与紧急访问审批前强制再认证', 'env://OPENEMR2026_RISK_REAUTH_POLICY')
                ) as seed(config_id, config_key, display_name, description, value_type, scope, inheritance, configured_value, secret_reference)
                on conflict (tenant_id, config_id) do nothing
                """).param("tenant", TENANT_ID).param("author", USER_ID).update();
        jdbc.sql("""
                insert into config_item(
                  tenant_id, config_id, config_type, config_key, display_name, payload,
                  status, row_version, schema_version, validation_state, validation_errors,
                  approval_state, created_by)
                select :tenant, seed.config_id::uuid, 'MASTER_DATA', seed.config_key,
                  seed.display_name,
                  jsonb_build_object(
                    'schema_version', 1, 'description', seed.description,
                    'code_system', seed.code_system, 'hierarchy', string_to_array(seed.hierarchy, '>'),
                    'effective_period', '2026-01-01/2099-12-31',
                    'import_policy', seed.import_policy),
                  'DRAFT', 1, 1, 'NOT_VALIDATED', '[]'::jsonb, 'DRAFT', :author
                from (values
                  ('018f0000-0000-7000-8000-00000000c201', 'syn-drug-catalog-v1', '药品目录主数据',
                    '药品、剂型、规格与生产厂商目录', 'NMPA-DRUG-CATALOG',
                    '药品>心血管用药>降压药>氨氯地平', '国家本位码唯一；停用不影响历史处方'),
                  ('018f0000-0000-7000-8000-00000000c202', 'syn-lab-catalog-v1', '检验项目主数据',
                    'LIS 检验项目与标准单位映射', 'LOINC-CN-LAB',
                    '检验>生化>电解质>血钾', '单位和参考区间冲突进入人工复核'),
                  ('018f0000-0000-7000-8000-00000000c203', 'syn-device-catalog-v1', '医疗设备主数据',
                    '床旁监护、影像和检验设备目录', 'OPENEMR2026-DEVICE',
                    '设备>床旁监护>心电监护仪>CARD-MON-01', '设备身份、校准状态与责任科室联合校验'),
                  ('018f0000-0000-7000-8000-00000000c204', 'syn-bed-catalog-v1', '床位与护理单元主数据',
                    '按科室-床号维护病区床位', 'OPENEMR2026-BED',
                    '心血管内科>心内科一病区>心血管内科-01床', '占用床位禁止停用；历史住院绑定原床位版本'),
                  ('018f0000-0000-7000-8000-00000000c205', 'syn-treatment-catalog-v1', '诊疗项目主数据',
                    '诊疗、护理、手术与物价项目映射', 'OPENEMR2026-TREATMENT',
                    '诊疗项目>心血管诊疗>冠状动脉介入>冠脉造影', '项目编码与物价版本同步；临床停用需医务处确认'),
                  ('018f0000-0000-7000-8000-00000000c206', 'syn-imaging-catalog-v1', '检查项目与部位主数据',
                    'RIS/PACS 检查、部位、体位与设备能力映射', 'DICOM-RIS-PROCEDURE',
                    '检查>影像>胸部>CT 平扫', '部位与 DICOM 编码冲突进入影像科人工复核'),
                  ('018f0000-0000-7000-8000-00000000c207', 'syn-supply-catalog-v1', '医用耗材主数据',
                    'SPD 耗材、规格、UDI 与供应商资质目录', 'UDI-SPD-SUPPLY',
                    '耗材>心血管介入>血管支架>药物洗脱支架', 'UDI 唯一；供应商资质过期后禁止新增领用')
                ) as seed(config_id, config_key, display_name, description, code_system, hierarchy, import_policy)
                on conflict (tenant_id, config_id) do nothing
                """).param("tenant", TENANT_ID).param("author", USER_ID).update();
        jdbc.sql("""
                insert into config_item(
                  tenant_id, config_id, config_type, config_key, display_name, payload,
                  status, row_version, schema_version, validation_state, validation_errors,
                  approval_state, created_by)
                select :tenant, seed.config_id::uuid, 'JOB', seed.config_key, seed.display_name,
                  jsonb_build_object(
                    'schema_version', 1, 'description', seed.description,
                    'schedule', seed.schedule, 'batch_size', seed.batch_size,
                    'retry_policy', seed.retry_policy,
                    'reconciliation_rule', seed.reconciliation_rule,
                    'notification_channels', string_to_array(seed.notification_channels, ','),
                    'channel_owner', seed.channel_owner),
                  'DRAFT', 1, 1, 'NOT_VALIDATED', '[]'::jsonb, 'DRAFT', :author
                from (values
                  ('018f0000-0000-7000-8000-00000000c221', 'syn-workforce-import-v1', '人员批量导入',
                    '人员、账号与岗位任期批量导入', 'MANUAL', 1650,
                    '仅重试 8 个隔离失败项；成功项保持幂等', '成功 1642，隔离 8，总数必须为 1650', '站内信,邮件', '人力资源处信息员'),
                  ('018f0000-0000-7000-8000-00000000c222', 'syn-lis-master-sync-v1', 'LIS 主数据同步',
                    '检验项目、单位和参考区间同步', '0 0/15 * * * *', 2106,
                    '冲突项转人工，不覆盖当前有效版本', '成功 2089，冲突 17，总数必须为 2106', '站内信,Webhook', '数据治理组'),
                  ('018f0000-0000-7000-8000-00000000c223', 'syn-archive-verify-v1', '病案长期验真',
                    '病案封包哈希与长期保存抽样恢复', '0 0 2 * * *', 186420,
                    '哈希异常立即隔离并创建安全事件', '校验 186420，通过 186420，异常 0', '站内信,短信,邮件', '病案统计室'),
                  ('018f0000-0000-7000-8000-00000000c224', 'syn-permission-review-v1', '权限季度复核通知',
                    '高权、闲置和离岗授权季度复核', '0 0 9 1 */3 *', 64,
                    '未送达通知每日重试，最多 3 日', '应复核 64，已送达 64，待关闭 7', '站内信,短信,邮件', '信息安全组')
                ) as seed(config_id, config_key, display_name, description, schedule, batch_size, retry_policy, reconciliation_rule, notification_channels, channel_owner)
                on conflict (tenant_id, config_id) do update set payload = excluded.payload,
                  display_name = excluded.display_name, updated_at = now(), row_version = config_item.row_version + 1
                where config_item.payload is distinct from excluded.payload
                """).param("tenant", TENANT_ID).param("author", USER_ID).update();
        jdbc.sql("""
                insert into config_item(
                  tenant_id, config_id, config_type, config_key, display_name, payload,
                  status, row_version, schema_version, validation_state, validation_errors,
                  approval_state, created_by, approved_by, published_at)
                select :tenant, seed.config_id::uuid, 'ROLE_CATALOG', seed.config_key,
                  seed.display_name,
                  jsonb_build_object(
                    'schema_version', 1, 'object_type', seed.object_type,
                    'parent_role_code', seed.parent_role_code,
                    'permission_summary', seed.permission_summary,
                    'scope', seed.scope, 'owner', seed.owner,
                    'description', seed.description),
                  'ACTIVE', 1, 1, 'VALID', '[]'::jsonb, 'APPROVED', :author, :approver,
                  now() - interval '30 days'
                from (values
                  ('018f0000-0000-7000-8000-00000000c241', 'CLINICIAN', '医生基础角色', 'ROLE', '—',
                    '普通病历查看、草拟与医嘱候选', '全院', '医务处', '临床医师基础权限模板'),
                  ('018f0000-0000-7000-8000-00000000c242', 'ROLE-IP-CARD', '心内科住院医生', 'ROLE', 'CLINICIAN',
                    '心内科住院病历、医嘱与交接班', '心内科病区', '心内科主任', '心内科住院岗位角色'),
                  ('018f0000-0000-7000-8000-00000000c243', 'NURSE', '护士基础角色', 'ROLE', '—',
                    '护理记录、医嘱执行与病区交接', '全院', '护理部', '临床护理基础权限模板'),
                  ('018f0000-0000-7000-8000-00000000c244', 'SYSTEM_ADMIN', '系统管理员', 'ROLE', '—',
                    '发布系统配置、重置账户与管理机构目录', '本机构', '信息中心主任', '高权管理角色，必须季度复核'),
                  ('018f0000-0000-7000-8000-00000000c245', 'GROUP-CV-ONCALL', '心血管会诊值班组', 'WORKGROUP', '—',
                    '跨科会诊、危急值升级与值班任务分派', '全院', '医务处值班中心', '不直接赋权，仅表达协作分派')
                ) as seed(config_id, config_key, display_name, object_type, parent_role_code,
                  permission_summary, scope, owner, description)
                on conflict (tenant_id, config_id) do update set payload = excluded.payload,
                  display_name = excluded.display_name, updated_at = now(), row_version = config_item.row_version + 1
                where config_item.payload is distinct from excluded.payload
                """).param("tenant", TENANT_ID).param("author", USER_ID)
                .param("approver", COLLABORATOR_USER_ID).update();
        jdbc.sql("""
                insert into config_item_revision(
                  tenant_id, config_id, revision_no, display_name, payload, schema_version,
                  status, validation_state, validation_errors, approval_state, changed_by,
                  change_reason)
                select item.tenant_id, item.config_id, item.row_version, item.display_name, item.payload,
                  item.schema_version, item.status, item.validation_state, item.validation_errors,
                  item.approval_state, :author, 'dev-synthetic complex acceptance fixture'
                from config_item item
                where item.tenant_id = :tenant and item.config_key like 'syn-%-v1'
                  and not exists (
                    select 1 from config_item_revision revision
                    where revision.tenant_id = item.tenant_id and revision.config_id = item.config_id
                      and revision.revision_no = item.row_version)
                """).param("tenant", TENANT_ID).param("author", USER_ID).update();
    }

    private void upsertBusinessConfigurationFixtures() {
        jdbc.sql("""
                insert into capability_pack(
                  tenant_id, capability_pack_id, pack_code, pack_name, inherits_from, status)
                select :tenant, seed.capability_pack_id::uuid, seed.pack_code,
                  seed.pack_name, seed.inherits_from, 'ACTIVE'
                from (values
                  ('018f0000-0000-7000-8000-00000000c301', 'SYN-CORE-CLINICAL', '临床核心能力包', null),
                  ('018f0000-0000-7000-8000-00000000c302', 'SYN-TERTIARY-HOSPITAL', '三级医院增强能力包', 'SYN-CORE-CLINICAL'),
                  ('018f0000-0000-7000-8000-00000000c303', 'SYN-CARDIOLOGY', '心血管专科能力包', 'SYN-TERTIARY-HOSPITAL')
                ) as seed(capability_pack_id, pack_code, pack_name, inherits_from)
                on conflict (tenant_id, pack_code) do nothing
                """).param("tenant", TENANT_ID).update();
        jdbc.sql("""
                insert into config_item(
                  tenant_id, config_id, config_type, config_key, display_name, payload,
                  status, row_version, schema_version, validation_state, validation_errors,
                  approval_state, created_by)
                values (:tenant, '018f0000-0000-7000-8000-00000000c304'::uuid,
                  'CAPABILITY_PACK_COMPOSITION', 'composition-syn-cardiology', '心血管专科能力包 · 能力组合',
                  jsonb_build_object(
                    'schema_version', 2,
                    'capability_pack_id', '018f0000-0000-7000-8000-00000000c303',
                    'selected_modules', jsonb_build_array('CORE_PATIENT','CLINICAL_RECORD','ORDER_RESULT','DIGITAL_SIGNATURE','AUDIT_OUTBOX','SPECIALTY_CARDIOLOGY'),
                    'dependencies', jsonb_build_array(
                      jsonb_build_object('module','CLINICAL_RECORD','requires','CORE_PATIENT'),
                      jsonb_build_object('module','ORDER_RESULT','requires','CORE_PATIENT'),
                      jsonb_build_object('module','DIGITAL_SIGNATURE','requires','CLINICAL_RECORD'),
                      jsonb_build_object('module','AUDIT_OUTBOX','requires','CORE_PATIENT'),
                      jsonb_build_object('module','SPECIALTY_CARDIOLOGY','requires','CLINICAL_RECORD'),
                      jsonb_build_object('module','SPECIALTY_CARDIOLOGY','requires','ORDER_RESULT')),
                    'conflicts', jsonb_build_array(jsonb_build_object('left','LEGACY_EXPORT','right','SPECIALTY_CARDIOLOGY')),
                    'protected_modules', jsonb_build_array('CORE_PATIENT','CLINICAL_RECORD','DIGITAL_SIGNATURE','AUDIT_OUTBOX'),
                    'scope_overrides', jsonb_build_array(jsonb_build_object('scope','心血管内科','module','SPECIALTY_CARDIOLOGY','effect','ENABLE')),
                    'rating_impact', '专科闭环 · A',
                    'rollout_tasks', jsonb_build_array('依赖解析','合成病例回放','科室负责人联合签署')),
                  'DRAFT', 1, 2, 'NOT_VALIDATED', '[]'::jsonb, 'DRAFT', :author)
                on conflict (tenant_id, config_id) do update set payload = excluded.payload,
                  display_name = excluded.display_name, updated_at = now(), row_version = config_item.row_version + 1
                where config_item.payload is distinct from excluded.payload
                """).param("tenant", TENANT_ID).param("author", USER_ID).update();
        jdbc.sql("""
                insert into capability_pack_release(
                  tenant_id, release_id, capability_pack_id, release_version, lifecycle_status,
                  canary_started_at, promoted_at, retired_at, rollback_reason,
                  released_by, released_at, row_version)
                select :tenant, seed.release_id::uuid, seed.capability_pack_id::uuid,
                  seed.release_version, seed.lifecycle_status,
                  seed.canary_started_at, seed.promoted_at, null, null,
                  :author, seed.released_at, seed.row_version
                from (values
                  ('018f0000-0000-7000-8000-00000000c311', '018f0000-0000-7000-8000-00000000c301',
                    '2026.8.1', 'ACTIVE', now() - interval '60 days', now() - interval '45 days',
                    now() - interval '75 days', 3::bigint),
                  ('018f0000-0000-7000-8000-00000000c312', '018f0000-0000-7000-8000-00000000c302',
                    '2026.8.2-rc1', 'CANARY', now() - interval '7 days', null,
                    now() - interval '14 days', 2::bigint),
                  ('018f0000-0000-7000-8000-00000000c313', '018f0000-0000-7000-8000-00000000c303',
                    '2026.9.0-draft', 'DRAFT', null, null,
                    now() - interval '3 days', 1::bigint)
                ) as seed(release_id, capability_pack_id, release_version, lifecycle_status,
                  canary_started_at, promoted_at, released_at, row_version)
                on conflict (tenant_id, release_id) do nothing
                """).param("tenant", TENANT_ID).param("author", USER_ID).update();
        jdbc.sql("""
                insert into specialty_pack_release(
                  tenant_id, specialty_pack_release_id, pack_code, semantic_version,
                  content_hash, manifest, lifecycle_status, compatibility_range, created_by)
                select :tenant, seed.release_id::uuid, seed.pack_code, seed.semantic_version,
                  seed.content_hash, seed.manifest::jsonb, 'ACTIVE', seed.compatibility::jsonb, :author
                from (values
                  ('018f0000-0000-7000-8000-00000000c401', 'SYN-SP-GENERAL', '1.2.0',
                    '1111111111111111111111111111111111111111111111111111111111111111',
                    '{"scope":"GENERAL_MEDICINE","modules":["record","order","result"]}',
                    '{"core":">=2026.8.0"}'),
                  ('018f0000-0000-7000-8000-00000000c402', 'SYN-SP-CARDIOLOGY', '2.0.1',
                    '2222222222222222222222222222222222222222222222222222222222222222',
                    '{"scope":"CARDIOLOGY","modules":["ecg","critical-value","consult"]}',
                    '{"core":">=2026.8.0","terminology":"2026.1"}'),
                  ('018f0000-0000-7000-8000-00000000c403', 'SYN-SP-PEDIATRICS', '1.0.0',
                    '3333333333333333333333333333333333333333333333333333333333333333',
                    '{"scope":"PEDIATRICS","modules":["weight-dose","growth-chart"]}',
                    '{"core":">=2026.8.0"}')
                ) as seed(release_id, pack_code, semantic_version, content_hash, manifest, compatibility)
                on conflict (tenant_id, pack_code, semantic_version) do nothing
                """).param("tenant", TENANT_ID).param("author", USER_ID).update();
        jdbc.sql("""
                insert into department_support_assessment(
                  tenant_id, department_support_assessment_id, facility_id, department_id,
                  clinical_scope_code, support_level, pack_release_id, evidence_bundle_hash,
                  missing_safety_gates, assessed_by, assessed_at, expires_at, row_version)
                select :tenant, seed.assessment_id::uuid, :facility, :department,
                  seed.clinical_scope_code, seed.support_level, seed.pack_release_id::uuid,
                  seed.evidence_bundle_hash, seed.missing_safety_gates,
                  :author, now() - interval '1 day', seed.expires_at, 1
                from (values
                  ('018f0000-0000-7000-8000-00000000c411', 'GENERAL_MEDICINE', 'GENERAL_AVAILABLE',
                    '018f0000-0000-7000-8000-00000000c401',
                    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                    '{}'::text[], now() + interval '180 days'),
                  ('018f0000-0000-7000-8000-00000000c412', 'CARDIOLOGY', 'BASIC_CLOSED_LOOP',
                    '018f0000-0000-7000-8000-00000000c402',
                    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
                    '{}'::text[], now() + interval '120 days'),
                  ('018f0000-0000-7000-8000-00000000c413', 'PEDIATRICS', 'PACK_PENDING',
                    '018f0000-0000-7000-8000-00000000c403', null,
                    array['PEDIATRIC_DRUG_CATALOG', 'GROWTH_STANDARD']::text[], null),
                  ('018f0000-0000-7000-8000-00000000c414', 'MENTAL_HEALTH', 'UNSUPPORTED',
                    null, null, array['CONSENT_TEMPLATE', 'RESTRICTED_DATA_REVIEW']::text[], null)
                ) as seed(assessment_id, clinical_scope_code, support_level, pack_release_id,
                  evidence_bundle_hash, missing_safety_gates, expires_at)
                on conflict (tenant_id, facility_id, department_id, clinical_scope_code) do nothing
                """).param("tenant", TENANT_ID).param("facility", FACILITY_ID)
                .param("department", SYNTHETIC_DEPARTMENT_ID).param("author", USER_ID).update();
    }

    private void upsertAdministrationFixtures() {
        jdbc.sql("""
                insert into dictionary_item(
                  tenant_id, dictionary_item_id, dictionary_code, item_code, item_name,
                  status, effective_from)
                select :tenant, seed.item_id::uuid, seed.dictionary_code, seed.item_code,
                  seed.item_name, 'ACTIVE', date '2026-01-01'
                from (values
                  ('018f0000-0000-7000-8000-00000000d101', 'GENDER', 'M', '男性 / Male'),
                  ('018f0000-0000-7000-8000-00000000d102', 'GENDER', 'F', '女性 / Female'),
                  ('018f0000-0000-7000-8000-00000000d103', 'GENDER', 'U', '未知 / Unknown'),
                  ('018f0000-0000-7000-8000-00000000d111', 'ENCOUNTER_TYPE', 'OPD', '门诊 / Outpatient'),
                  ('018f0000-0000-7000-8000-00000000d112', 'ENCOUNTER_TYPE', 'ED', '急诊 / Emergency'),
                  ('018f0000-0000-7000-8000-00000000d113', 'ENCOUNTER_TYPE', 'IPD', '住院 / Inpatient'),
                  ('018f0000-0000-7000-8000-00000000d121', 'ALLERGY_SEVERITY', 'MILD', '轻度 / Mild'),
                  ('018f0000-0000-7000-8000-00000000d122', 'ALLERGY_SEVERITY', 'MODERATE', '中度 / Moderate'),
                  ('018f0000-0000-7000-8000-00000000d123', 'ALLERGY_SEVERITY', 'SEVERE', '重度 / Severe'),
                  ('018f0000-0000-7000-8000-00000000d131', 'LAB_UNIT', 'MMOL_L', '毫摩尔每升 / mmol/L'),
                  ('018f0000-0000-7000-8000-00000000d132', 'LAB_UNIT', 'MG_L', '毫克每升 / mg/L')
                ) as seed(item_id, dictionary_code, item_code, item_name)
                on conflict (tenant_id, dictionary_code, item_code) do nothing
                """).param("tenant", TENANT_ID).update();
        jdbc.sql("""
                insert into authorization_policy(
                  tenant_id, policy_id, policy_code, version_no, effect, status,
                  subject_role_code, resource_type, action_code, organization_id, facility_id,
                  patient_relationship_required, relationship_types, resource_statuses,
                  purpose_codes, emergency_override_allowed, priority, valid_from,
                  created_by, approved_by, published_at)
                select :tenant, seed.policy_id::uuid, seed.policy_code, 1, seed.effect, seed.status,
                  seed.role_code, seed.resource_type, seed.action_code, :organization, :facility,
                  seed.relationship_required, seed.relationship_types::text[], array['ACTIVE'],
                  seed.purpose_codes::text[], true, seed.priority, now() - interval '30 days',
                  seed.created_by::uuid,
                  case when seed.status = 'PUBLISHED' then :approver else null end,
                  case when seed.status = 'PUBLISHED' then now() - interval '7 days' else null end
                from (values
                  ('018f0000-0000-7000-8000-00000000d201', 'CLINICAL-DOCUMENT-READ', 'ALLOW', 'PUBLISHED', 'CLINICIAN', 'CLINICAL_DOCUMENT', 'READ', true, '{CARE_TEAM}', '{DIRECT_CARE}', 700, '018f0000-0000-7000-8000-00000000aa04'),
                  ('018f0000-0000-7000-8000-00000000d202', 'CLINICAL-DOCUMENT-WRITE', 'ALLOW', 'PUBLISHED', 'CLINICIAN', 'CLINICAL_DOCUMENT', 'WRITE_DRAFT', true, '{CARE_TEAM}', '{DOCUMENT_DRAFT}', 720, '018f0000-0000-7000-8000-00000000aa04'),
                  ('018f0000-0000-7000-8000-00000000d203', 'SYSTEM-ADMIN-WORKFORCE', 'ALLOW', 'PUBLISHED', 'SYSTEM_ADMIN', 'WORKFORCE_PERSON', 'MANAGE', false, '{}', '{ADMINISTRATION}', 900, '018f0000-0000-7000-8000-00000000aa04'),
                  ('018f0000-0000-7000-8000-00000000d204', 'CROSS-DEPARTMENT-EXPORT-DENY', 'DENY', 'PUBLISHED', 'CLINICIAN', 'CLINICAL_DOCUMENT', 'EXPORT', false, '{}', '{SECONDARY_USE}', 1000, '018f0000-0000-7000-8000-00000000aa04'),
                  ('018f0000-0000-7000-8000-00000000d205', 'RESEARCH-DATASET-READ', 'ALLOW', 'DRAFT', 'RESEARCHER', 'RESEARCH_DATASET', 'READ', false, '{}', '{RESEARCH}', 500, '018f0000-0000-7000-8000-00000000aa06')
                ) as seed(policy_id, policy_code, effect, status, role_code, resource_type,
                  action_code, relationship_required, relationship_types, purpose_codes,
                  priority, created_by)
                on conflict (tenant_id, policy_code, version_no) do nothing
                """).param("tenant", TENANT_ID).param("organization", ORGANIZATION_ID)
                .param("facility", FACILITY_ID).param("approver", COLLABORATOR_USER_ID).update();
    }

    private void upsertOutpatientClinicalFixture() {
        UUID patientId = UUID.fromString("018f0000-0000-7000-8000-000000000001");
        UUID encounterId = UUID.fromString("018f0000-0000-7000-8000-000000000101");

        jdbc.sql("""
                insert into clinical_diagnosis(
                  tenant_id, diagnosis_id, patient_id, encounter_id, facility_id, lifecycle_status,
                  current_diagnosis_role, current_version_id, author_user_id)
                select :tenant, '018f0000-0000-7000-8000-00000000ed01'::uuid, :patient, :encounter,
                  :facility, 'ACTIVE', 'PRIMARY', '018f0000-0000-7000-8000-00000000ed11'::uuid, :author
                where not exists (
                  select 1 from clinical_diagnosis where tenant_id = :tenant and encounter_id = :encounter
                    and lifecycle_status = 'ACTIVE' and current_diagnosis_role = 'PRIMARY')
                on conflict (tenant_id, diagnosis_id) do nothing
                """).param("tenant", TENANT_ID).param("patient", patientId).param("encounter", encounterId)
                .param("facility", FACILITY_ID).param("author", USER_ID).update();
        jdbc.sql("""
                insert into clinical_diagnosis_version(
                  tenant_id, diagnosis_version_id, diagnosis_id, version_no, terminology_system,
                  terminology_release, code, code_display_snapshot, diagnosis_text, diagnosis_role,
                  certainty, evidence_summary, plan_summary, effective_at, change_type, authored_by)
                select :tenant, '018f0000-0000-7000-8000-00000000ed11'::uuid,
                  '018f0000-0000-7000-8000-00000000ed01'::uuid, 1, 'ICD-10-CN', '2026B', 'I10.0',
                  '原发性高血压（更新术语）', '原发性高血压 2 级（高危）', 'PRIMARY', 'CONFIRMED',
                  '诊室血压 168/102 mmHg，家庭血压监测连续升高',
                  '评估靶器官损害，启动降压治疗并安排两周复诊',
                  now() - interval '2 hour', 'CREATED', :author
                where exists (select 1 from clinical_diagnosis where tenant_id = :tenant
                  and diagnosis_id = '018f0000-0000-7000-8000-00000000ed01'::uuid)
                on conflict (tenant_id, diagnosis_version_id) do nothing
                """).param("tenant", TENANT_ID).param("author", USER_ID).update();
        jdbc.sql("""
                insert into clinical_diagnosis(
                  tenant_id, diagnosis_id, patient_id, encounter_id, facility_id, lifecycle_status,
                  current_diagnosis_role, current_version_id, author_user_id)
                values (:tenant, '018f0000-0000-7000-8000-00000000ed02'::uuid, :patient, :encounter,
                  :facility, 'ACTIVE', 'DIFFERENTIAL', '018f0000-0000-7000-8000-00000000ed12'::uuid, :author)
                on conflict (tenant_id, diagnosis_id) do nothing
                """).param("tenant", TENANT_ID).param("patient", patientId).param("encounter", encounterId)
                .param("facility", FACILITY_ID).param("author", USER_ID).update();
        jdbc.sql("""
                insert into clinical_diagnosis_version(
                  tenant_id, diagnosis_version_id, diagnosis_id, version_no, terminology_system,
                  terminology_release, code, code_display_snapshot, diagnosis_text, diagnosis_role,
                  certainty, evidence_summary, plan_summary, effective_at, change_type, authored_by)
                values (:tenant, '018f0000-0000-7000-8000-00000000ed12'::uuid,
                  '018f0000-0000-7000-8000-00000000ed02'::uuid, 1, 'ICD-10-CN', '2026B', 'I10.9',
                  '高血压病', '继发性高血压待排', 'DIFFERENTIAL', 'PROVISIONAL',
                  '发病年龄与血压波动需要结合肾功能及内分泌筛查',
                  '复核药物史，完善肾功能、电解质和尿常规', now() - interval '90 minute',
                  'CREATED', :author)
                on conflict (tenant_id, diagnosis_version_id) do nothing
                """).param("tenant", TENANT_ID).param("author", USER_ID).update();

        jdbc.sql("""
                insert into medication_catalog_version(
                  tenant_id, medication_catalog_version_id, catalog_code, drug_code, ingredient_code,
                  display_name, minimum_single_dose, maximum_single_dose, dose_unit,
                  effective_from, release_version, status)
                values (:tenant, '018f0000-0000-7000-8000-00000000ef01'::uuid, 'MED-AMLODIPINE-5',
                  'DRUG-AMLODIPINE', 'ING-AMLODIPINE', '苯磺酸氨氯地平片', 2.5, 10, 'mg',
                  date '2026-01-01', '2026.1', 'ACTIVE')
                on conflict (tenant_id, medication_catalog_version_id) do nothing
                """).param("tenant", TENANT_ID).update();
        upsertOutpatientOrder("018f0000-0000-7000-8000-00000000ef11", "ACTIVE",
                "控制高血压并降低心脑血管风险");
        jdbc.sql("""
                insert into clinical_order_item(
                  tenant_id, order_item_id, order_id, item_type, catalog_code, display_name,
                  requested_quantity, quantity_unit, instructions, item_state,
                  medication_catalog_version_id, drug_code, ingredient_code, dose_value,
                  dose_unit, route_code, frequency_code)
                values (:tenant, '018f0000-0000-7000-8000-00000000ef21'::uuid,
                  '018f0000-0000-7000-8000-00000000ef11'::uuid, 'MEDICATION', 'MED-AMLODIPINE-5',
                  '苯磺酸氨氯地平片', 14, '片', '每日上午口服，监测血压及下肢水肿', 'ACTIVE',
                  '018f0000-0000-7000-8000-00000000ef01'::uuid, 'DRUG-AMLODIPINE',
                  'ING-AMLODIPINE', 5, 'mg', 'PO', 'QD')
                on conflict (tenant_id, order_item_id) do nothing
                """).param("tenant", TENANT_ID).update();
        upsertExecutionTask("018f0000-0000-7000-8000-00000000ef31",
                "018f0000-0000-7000-8000-00000000ef11", "018f0000-0000-7000-8000-00000000ef21",
                patientId, encounterId, "PENDING", 14, 0, "片");

        upsertOutpatientOrder("018f0000-0000-7000-8000-00000000ef12", "COMPLETED",
                "评估高血压相关肾功能与电解质异常");
        upsertOrderItem("018f0000-0000-7000-8000-00000000ef22",
                "018f0000-0000-7000-8000-00000000ef12", "LAB", "LAB-K", "血钾", "COMPLETED");
        upsertExecutionTask("018f0000-0000-7000-8000-00000000ef32",
                "018f0000-0000-7000-8000-00000000ef12", "018f0000-0000-7000-8000-00000000ef22",
                patientId, encounterId, "COMPLETED", 1, 1, "次");

        upsertOutpatientOrder("018f0000-0000-7000-8000-00000000ef13", "ACTIVE",
                "评估长期高血压导致的心脏结构改变");
        upsertOrderItem("018f0000-0000-7000-8000-00000000ef23",
                "018f0000-0000-7000-8000-00000000ef13", "IMAGING", "IMG-ECHO", "超声心动图", "ACTIVE");
        upsertExecutionTask("018f0000-0000-7000-8000-00000000ef33",
                "018f0000-0000-7000-8000-00000000ef13", "018f0000-0000-7000-8000-00000000ef23",
                patientId, encounterId, "PENDING", 1, 0, "次");

        jdbc.sql("""
                insert into clinical_result(
                  tenant_id, result_id, patient_id, encounter_id, facility_id, order_id,
                  execution_task_id, report_type, source_system, source_report_key,
                  current_version_id, author_user_id)
                values (:tenant, '018f0000-0000-7000-8000-00000000ef41'::uuid, :patient, :encounter,
                  :facility, '018f0000-0000-7000-8000-00000000ef12'::uuid,
                  '018f0000-0000-7000-8000-00000000ef32'::uuid, 'LAB', 'SYNTHETIC_LIS',
                  'SYN-OPD-001-K', '018f0000-0000-7000-8000-00000000ef42'::uuid, :author)
                on conflict (tenant_id, result_id) do nothing
                """).param("tenant", TENANT_ID).param("patient", patientId).param("encounter", encounterId)
                .param("facility", FACILITY_ID).param("author", USER_ID).update();
        jdbc.sql("""
                insert into clinical_result_version(
                  tenant_id, result_version_id, result_id, version_no, report_status, conclusion,
                  reported_at, change_type, authored_by)
                values (:tenant, '018f0000-0000-7000-8000-00000000ef42'::uuid,
                  '018f0000-0000-7000-8000-00000000ef41'::uuid, 1, 'FINAL',
                  '血钾轻度降低，建议结合用药及肾功能复核并安排复查。',
                  now() - interval '45 minute', 'INITIAL', :author)
                on conflict (tenant_id, result_version_id) do nothing
                """).param("tenant", TENANT_ID).param("author", USER_ID).update();
        jdbc.sql("""
                insert into clinical_result_observation(
                  tenant_id, observation_id, result_version_id, item_code, item_name, value_type,
                  numeric_value, unit, reference_low, reference_high, abnormal_flag)
                values (:tenant, '018f0000-0000-7000-8000-00000000ef43'::uuid,
                  '018f0000-0000-7000-8000-00000000ef42'::uuid, 'K', '血钾', 'NUMERIC',
                  3.3, 'mmol/L', 3.5, 5.5, 'LOW')
                on conflict (tenant_id, observation_id) do nothing
                """).param("tenant", TENANT_ID).update();

        jdbc.sql("""
                insert into referral(
                  tenant_id, referral_id, patient_id, encounter_id, facility_id, referral_type,
                  target_department, reason, clinical_summary, status, sent_at)
                values (:tenant, '018f0000-0000-7000-8000-00000000ef51'::uuid, :patient, :encounter,
                  :facility, 'INTERNAL', '心血管内科', '高血压高危分层及用药方案会诊',
                  '血压持续升高，已完善血钾检查并启动基础降压治疗，请评估继发因素及联合用药。',
                  'SENT', now() - interval '30 minute')
                on conflict (tenant_id, referral_id) do nothing
                """).param("tenant", TENANT_ID).param("patient", patientId).param("encounter", encounterId)
                .param("facility", FACILITY_ID).update();
        jdbc.sql("""
                insert into referral(
                  tenant_id, referral_id, patient_id, encounter_id, facility_id, referral_type,
                  target_department, reason, clinical_summary, status)
                values (:tenant, '018f0000-0000-7000-8000-00000000ef52'::uuid, :patient, :encounter,
                  :facility, 'INTERNAL', '营养科', '高血压生活方式干预评估',
                  '需要制定限盐、体重管理与家庭血压监测计划。', 'DRAFT')
                on conflict (tenant_id, referral_id) do nothing
                """).param("tenant", TENANT_ID).param("patient", patientId).param("encounter", encounterId)
                .param("facility", FACILITY_ID).update();
    }

    private void upsertOutpatientOrder(String orderId, String status, String indication) {
        jdbc.sql("""
                insert into clinical_order(
                  tenant_id, order_id, patient_id, encounter_id, facility_id, order_scope, status,
                  clinical_indication, author_user_id, signed_by, signed_at, rule_watermark)
                values (:tenant, cast(:order as uuid), '018f0000-0000-7000-8000-000000000001'::uuid,
                  '018f0000-0000-7000-8000-000000000101'::uuid, :facility, 'TEMPORARY', :status,
                  :indication, :author, :author, now() - interval '1 hour', 'RULESET-MEDICATION-6')
                on conflict (tenant_id, order_id) do nothing
                """).param("tenant", TENANT_ID).param("order", orderId).param("facility", FACILITY_ID)
                .param("status", status).param("indication", indication).param("author", USER_ID).update();
    }

    private void upsertOrderItem(
            String itemId, String orderId, String itemType, String catalogCode, String displayName, String state) {
        jdbc.sql("""
                insert into clinical_order_item(
                  tenant_id, order_item_id, order_id, item_type, catalog_code, display_name,
                  requested_quantity, quantity_unit, instructions, item_state)
                values (:tenant, cast(:item as uuid), cast(:order as uuid), :type, :code, :name,
                  1, '次', '按申请完成并回传结构化结果', :state)
                on conflict (tenant_id, order_item_id) do nothing
                """).param("tenant", TENANT_ID).param("item", itemId).param("order", orderId)
                .param("type", itemType).param("code", catalogCode).param("name", displayName)
                .param("state", state).update();
    }

    private void upsertExecutionTask(
            String taskId, String orderId, String itemId, UUID patientId, UUID encounterId,
            String state, int requested, int performed, String unit) {
        jdbc.sql("""
                insert into order_execution_task(
                  tenant_id, execution_task_id, order_id, order_item_id, patient_id, encounter_id,
                  task_state, requested_quantity, performed_quantity, quantity_unit)
                values (:tenant, cast(:task as uuid), cast(:order as uuid), cast(:item as uuid),
                  :patient, :encounter, :state, :requested, :performed, :unit)
                on conflict (tenant_id, execution_task_id) do nothing
                """).param("tenant", TENANT_ID).param("task", taskId).param("order", orderId)
                .param("item", itemId).param("patient", patientId).param("encounter", encounterId)
                .param("state", state).param("requested", requested).param("performed", performed)
                .param("unit", unit).update();
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
                .param("code", "EMR." + documentTypeCode).param("display_name", displayName)
                .param("type", documentTypeCode).param("creator", USER_ID).update();
        jdbc.sql("""
                insert into clinical_document_template_version(
                  tenant_id, template_id, template_version_id, version_no, status,
                  section_schema, required_fields, display_rules, effective_from,
                  created_by, approved_by, published_at)
                values (:tenant, :template, :version, 1, 'PUBLISHED', cast(:schema as jsonb),
                  cast(:required as text[]), '{"fixture_source":"dev-simulation"}'::jsonb, now() - interval '1 day',
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
                  ('IP-FOUR-LEVEL-E2E', 'EMR.FOUR_LEVEL_REVIEW', '四级审签文书', 'COURSE', 'MANUAL', 1440, 'MEDICAL_RECORDS', '["case_summary","diagnostic_basis","treatment_course","quality_conclusion"]')
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
        jdbc.sql("insert into tenant(tenant_id, tenant_code, display_name, status) values (:id, 'JC-HEALTH', '江城市医疗集团', 'ACTIVE') on conflict (tenant_id) do update set tenant_code = excluded.tenant_code, display_name = excluded.display_name, status = 'ACTIVE'")
                .param("id", TENANT_ID).update();
        jdbc.sql("insert into organization(tenant_id, organization_id, organization_code, display_name, status) values (:tenant, :id, 'JC-DXFS', '江城大学附属医院', 'ACTIVE') on conflict (tenant_id, organization_id) do update set display_name = excluded.display_name, status = 'ACTIVE'")
                .param("tenant", TENANT_ID).param("id", ORGANIZATION_ID).update();
        jdbc.sql("insert into facility(tenant_id, organization_id, facility_id, facility_code, display_name, status) values (:tenant, :org, :id, 'JC-DXFS-BB', '江城大学附属医院本部', 'ACTIVE') on conflict (tenant_id, facility_id) do update set display_name = excluded.display_name, status = 'ACTIVE'")
                .param("tenant", TENANT_ID).param("org", ORGANIZATION_ID).param("id", FACILITY_ID).update();
        jdbc.sql("insert into app_user(tenant_id, user_id, external_subject, display_name, status) values (:tenant, :id, 'william.lin', '林伟 / William Lin', 'ACTIVE') on conflict (tenant_id, user_id) do update set external_subject = excluded.external_subject, display_name = excluded.display_name, status = 'ACTIVE'")
                .param("tenant", TENANT_ID).param("id", USER_ID).update();
        jdbc.sql("insert into app_user(tenant_id, user_id, external_subject, display_name, status) values (:tenant, :id, 'xue.wang', '王雪 / Xue Wang', 'ACTIVE') on conflict (tenant_id, user_id) do update set external_subject = excluded.external_subject, display_name = excluded.display_name, status = 'ACTIVE'")
                .param("tenant", TENANT_ID).param("id", COLLABORATOR_USER_ID).update();
        upsertSyntheticReviewer(ATTENDING_USER_ID, ATTENDING_ROLE_ID,
                "ming.zhou", "周明 / Ming Zhou", "ATTENDING_PHYSICIAN");
        upsertSyntheticReviewer(CHIEF_USER_ID, CHIEF_ROLE_ID,
                "lan.chen", "陈岚 / Lan Chen", "CHIEF_PHYSICIAN");
        upsertSyntheticReviewer(MEDICAL_RECORDS_USER_ID, MEDICAL_RECORDS_ROLE_ID,
                "chang.liu", "刘畅 / Chang Liu", "MEDICAL_RECORDS");
        jdbc.sql("""
                update workforce_person person
                set person_code = seed.person_code, display_name = seed.display_name,
                  status = 'ACTIVE', effective_until = null, row_version = person.row_version + 1,
                  updated_at = now()
                from (values
                  (cast(:clinician as uuid), 'DOC-10001', '林伟 / William Lin'),
                  (cast(:collaborator as uuid), 'DOC-10002', '王雪 / Xue Wang'),
                  (cast(:attending as uuid), 'DOC-10003', '周明 / Ming Zhou'),
                  (cast(:chief as uuid), 'DOC-10004', '陈岚 / Lan Chen'),
                  (cast(:records as uuid), 'HIM-10001', '刘畅 / Chang Liu')
                ) as seed(person_id, person_code, display_name)
                where person.tenant_id = :tenant and person.person_id = seed.person_id
                  and (person.person_code is distinct from seed.person_code
                    or person.display_name is distinct from seed.display_name
                    or person.status <> 'ACTIVE' or person.effective_until is not null)
                """).param("tenant", TENANT_ID).param("clinician", USER_ID)
                .param("collaborator", COLLABORATOR_USER_ID).param("attending", ATTENDING_USER_ID)
                .param("chief", CHIEF_USER_ID).param("records", MEDICAL_RECORDS_USER_ID).update();
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
                insert into dev_user_credential(tenant_id, user_id, username, password_hash)
                values (:tenant, :user, 'linwei', :password_hash)
                on conflict (tenant_id, user_id) do update set username = excluded.username
                """).param("tenant", TENANT_ID).param("user", USER_ID)
                .param("password_hash", new BCryptPasswordEncoder(12).encode(loginPassword)).update();
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
                set external_subject = excluded.external_subject,
                  display_name = excluded.display_name, status = 'ACTIVE'
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
                .param("sex", normalizeSyntheticSex(patient.path("gender_code").stringValue()))
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

    private void upsertDiseaseCases(List<SyntheticDiseaseCaseCatalog.DiseaseCase> cases) {
        UUID outpatientSlotId = scenarioId("catalog", "outpatient-slot");
        jdbc.sql("""
                insert into schedule_slot(
                  tenant_id, schedule_slot_id, organization_id, facility_id, department_id, doctor_user_id,
                  visit_type, slot_date, start_time, end_time, total_capacity, booked_count, status)
                values (:tenant, :slot, :org, :facility, :department, :doctor, 'OUTPATIENT', current_date,
                  time '08:00', time '18:00', 50, 20, 'OPEN')
                on conflict (tenant_id, schedule_slot_id) do update set slot_date = current_date,
                  department_id = excluded.department_id, doctor_user_id = excluded.doctor_user_id,
                  total_capacity = 50, booked_count = 20, status = 'OPEN', updated_at = now()
                """).param("tenant", TENANT_ID).param("slot", outpatientSlotId)
                .param("org", ORGANIZATION_ID).param("facility", FACILITY_ID)
                .param("department", SYNTHETIC_DEPARTMENT_ID).param("doctor", USER_ID).update();

        for (int index = 0; index < cases.size(); index++) {
            upsertDiseaseCase(cases.get(index), index, outpatientSlotId);
        }
    }

    private void upsertDiseaseCase(
            SyntheticDiseaseCaseCatalog.DiseaseCase item, int index, UUID outpatientSlotId) {
        UUID patientId = scenarioId(item.caseId(), "patient");
        UUID encounterId = scenarioId(item.caseId(), "encounter");
        String encounterStatus = encounterStatus(item.domain(), index);

        jdbc.sql("""
                insert into patient(tenant_id, patient_id, display_name, sex_code, birth_date, status)
                values (:tenant, :patient, :name, :sex, cast(:birth_date as date), 'ACTIVE')
                on conflict (tenant_id, patient_id) do update set display_name = excluded.display_name,
                  sex_code = excluded.sex_code, birth_date = excluded.birth_date, status = 'ACTIVE',
                  updated_at = now()
                """).param("tenant", TENANT_ID).param("patient", patientId)
                .param("name", item.patientName()).param("sex", item.sex())
                .param("birth_date", item.birthDate()).update();
        jdbc.sql("""
                insert into encounter(tenant_id, encounter_id, patient_id, organization_id, facility_id,
                  encounter_type, status, started_at, source_system, source_key)
                values (:tenant, :encounter, :patient, :org, :facility, :domain, :status,
                  now() - (:hours * interval '1 hour'), 'SYNTHETIC-50', :source_key)
                on conflict (tenant_id, encounter_id) do nothing
                """).param("tenant", TENANT_ID).param("encounter", encounterId).param("patient", patientId)
                .param("org", ORGANIZATION_ID).param("facility", FACILITY_ID).param("domain", item.domain())
                .param("status", encounterStatus).param("hours", 3 + index).param("source_key", item.caseId()).update();

        upsertDiseaseCaseDocument(item, patientId, encounterId, "primary-document",
                documentType(item.domain()), primarySections(item));
        upsertDiseaseCaseDiagnosis(item, patientId, encounterId);
        upsertDiseaseCaseOrderAndResult(item, patientId, encounterId);

        switch (item.domain()) {
            case "OUTPATIENT" -> upsertOutpatientDiseaseCase(item, index, patientId, encounterId, outpatientSlotId);
            case "EMERGENCY" -> upsertEmergencyDiseaseCase(item, index, patientId, encounterId);
            case "INPATIENT" -> upsertInpatientDiseaseCase(item, index, patientId, encounterId);
            default -> throw new IllegalArgumentException("Unsupported disease case domain: " + item.domain());
        }
    }

    private void upsertDiseaseCaseDocument(
            SyntheticDiseaseCaseCatalog.DiseaseCase item, UUID patientId, UUID encounterId,
            String key, String documentType, JsonNode sections) {
        UUID documentId = scenarioId(item.caseId(), key);
        var document = objectMapper.createObjectNode();
        document.put("document_id", documentId.toString());
        document.put("document_type_code", documentType);
        document.put("version_no", 1);
        document.put("status", "DRAFT");
        document.set("sections", sections);
        document.put("content_hash", syntheticHash(item.caseId() + ":" + key + ":" + sections));
        upsertDocument(patientId, encounterId, document);
    }

    private JsonNode primarySections(SyntheticDiseaseCaseCatalog.DiseaseCase item) {
        var sections = objectMapper.createObjectNode();
        sections.put("chief_complaint", item.chiefComplaint());
        sections.put("present_illness", item.presentIllness());
        sections.put("past_history", item.pastHistory());
        sections.put("allergy_history", item.allergyHistory());
        sections.put("physical_examination", item.physicalExamination());
        sections.put("vital_signs", item.vitalSigns());
        sections.put("assessment", item.diagnosisText());
        sections.put("diagnostic_evidence", item.evidenceSummary());
        sections.put("treatment_plan", item.treatmentPlan());
        sections.put("synthetic_case_notice", "本记录为 OpenEMR2026 完全合成测试病例，不对应真实患者。");
        return sections;
    }

    private void upsertDiseaseCaseDiagnosis(
            SyntheticDiseaseCaseCatalog.DiseaseCase item, UUID patientId, UUID encounterId) {
        UUID diagnosisId = scenarioId(item.caseId(), "diagnosis");
        UUID versionId = scenarioId(item.caseId(), "diagnosis-version");
        jdbc.sql("""
                insert into diagnosis_terminology_entry(
                  terminology_system, terminology_release, code, display_name,
                  lifecycle_status, effective_from)
                values ('ICD-10-CN', 'SYNTHETIC-50-V1', :code, :display, 'ACTIVE', date '2026-01-01')
                on conflict (terminology_system, terminology_release, code) do nothing
                """).param("code", item.diseaseCode()).param("display", item.diseaseName()).update();
        jdbc.sql("""
                insert into clinical_diagnosis(
                  tenant_id, diagnosis_id, patient_id, encounter_id, facility_id, lifecycle_status,
                  current_diagnosis_role, current_version_id, author_user_id)
                values (:tenant, :diagnosis, :patient, :encounter, :facility, 'ACTIVE',
                  'PRIMARY', :version, :author)
                on conflict (tenant_id, diagnosis_id) do nothing
                """).param("tenant", TENANT_ID).param("diagnosis", diagnosisId).param("patient", patientId)
                .param("encounter", encounterId).param("facility", FACILITY_ID)
                .param("version", versionId).param("author", USER_ID).update();
        jdbc.sql("""
                insert into clinical_diagnosis_version(
                  tenant_id, diagnosis_version_id, diagnosis_id, version_no, terminology_system,
                  terminology_release, code, code_display_snapshot, diagnosis_text, diagnosis_role,
                  certainty, evidence_summary, plan_summary, effective_at, change_type, authored_by)
                values (:tenant, :version, :diagnosis, 1, 'ICD-10-CN', 'SYNTHETIC-50-V1',
                  :code, :display, :diagnosis_text, 'PRIMARY', 'CONFIRMED', :evidence, :plan,
                  now() - interval '2 hour', 'CREATED', :author)
                on conflict (tenant_id, diagnosis_version_id) do nothing
                """).param("tenant", TENANT_ID).param("version", versionId).param("diagnosis", diagnosisId)
                .param("code", item.diseaseCode()).param("display", item.diseaseName())
                .param("diagnosis_text", item.diagnosisText()).param("evidence", item.evidenceSummary())
                .param("plan", item.treatmentPlan()).param("author", USER_ID).update();
    }

    private void upsertDiseaseCaseOrderAndResult(
            SyntheticDiseaseCaseCatalog.DiseaseCase item, UUID patientId, UUID encounterId) {
        UUID orderId = scenarioId(item.caseId(), "order");
        UUID orderItemId = scenarioId(item.caseId(), "order-item");
        UUID executionTaskId = scenarioId(item.caseId(), "execution-task");
        UUID resultId = scenarioId(item.caseId(), "result");
        UUID resultVersionId = scenarioId(item.caseId(), "result-version");
        UUID observationId = scenarioId(item.caseId(), "result-observation");

        jdbc.sql("""
                insert into clinical_order(
                  tenant_id, order_id, patient_id, encounter_id, facility_id, order_scope, status,
                  clinical_indication, author_user_id, signed_by, signed_at, rule_watermark)
                values (:tenant, :order, :patient, :encounter, :facility, 'TEMPORARY', 'COMPLETED',
                  :indication, :author, :author, now() - interval '90 minute', 'SYNTHETIC-50-V1')
                on conflict (tenant_id, order_id) do nothing
                """).param("tenant", TENANT_ID).param("order", orderId).param("patient", patientId)
                .param("encounter", encounterId).param("facility", FACILITY_ID)
                .param("indication", item.evidenceSummary()).param("author", USER_ID).update();
        jdbc.sql("""
                insert into clinical_order_item(
                  tenant_id, order_item_id, order_id, item_type, catalog_code, display_name,
                  requested_quantity, quantity_unit, instructions, item_state)
                values (:tenant, :item, :order, :type, :code, :name, 1, '次',
                  '用于合成病例诊断依据与疗效风险评估，结果需回写当前就诊。', 'COMPLETED')
                on conflict (tenant_id, order_item_id) do nothing
                """).param("tenant", TENANT_ID).param("item", orderItemId).param("order", orderId)
                .param("type", item.orderType()).param("code", item.orderCode()).param("name", item.orderName()).update();
        jdbc.sql("""
                insert into order_execution_task(
                  tenant_id, execution_task_id, order_id, order_item_id, patient_id, encounter_id,
                  task_state, requested_quantity, performed_quantity, quantity_unit)
                values (:tenant, :task, :order, :item, :patient, :encounter, 'COMPLETED', 1, 1, '次')
                on conflict (tenant_id, execution_task_id) do nothing
                """).param("tenant", TENANT_ID).param("task", executionTaskId).param("order", orderId)
                .param("item", orderItemId).param("patient", patientId).param("encounter", encounterId).update();
        jdbc.sql("""
                insert into clinical_result(
                  tenant_id, result_id, patient_id, encounter_id, facility_id, order_id,
                  execution_task_id, report_type, source_system, source_report_key,
                  current_version_id, author_user_id)
                values (:tenant, :result, :patient, :encounter, :facility, :order, :task, :report_type,
                  'SYNTHETIC-50', :source_key, :version, :author)
                on conflict (tenant_id, result_id) do nothing
                """).param("tenant", TENANT_ID).param("result", resultId).param("patient", patientId)
                .param("encounter", encounterId).param("facility", FACILITY_ID).param("order", orderId)
                .param("task", executionTaskId).param("report_type", item.orderType())
                .param("source_key", item.caseId() + ":" + item.resultCode())
                .param("version", resultVersionId).param("author", USER_ID).update();
        jdbc.sql("""
                insert into clinical_result_version(
                  tenant_id, result_version_id, result_id, version_no, report_status, conclusion,
                  reported_at, change_type, authored_by)
                values (:tenant, :version, :result, 1, 'FINAL', :conclusion,
                  now() - interval '1 hour', 'INITIAL', :author)
                on conflict (tenant_id, result_version_id) do nothing
                """).param("tenant", TENANT_ID).param("version", resultVersionId).param("result", resultId)
                .param("conclusion", item.resultName() + "结果已回传；" + item.evidenceSummary())
                .param("author", USER_ID).update();
        upsertDiseaseCaseResultObservation(item, resultVersionId, observationId);
    }

    private void upsertDiseaseCaseResultObservation(
            SyntheticDiseaseCaseCatalog.DiseaseCase item, UUID resultVersionId, UUID observationId) {
        if (item.resultValue().isNumber()) {
            jdbc.sql("""
                    insert into clinical_result_observation(
                      tenant_id, observation_id, result_version_id, item_code, item_name, value_type,
                      numeric_value, unit, reference_low, reference_high, abnormal_flag)
                    values (:tenant, :observation, :version, :code, :name, 'NUMERIC', :value,
                      :unit, :reference_low, :reference_high, :flag)
                    on conflict (tenant_id, observation_id) do nothing
                    """).param("tenant", TENANT_ID).param("observation", observationId)
                    .param("version", resultVersionId).param("code", item.resultCode())
                    .param("name", item.resultName()).param("value", item.resultValue().asDouble())
                    .param("unit", item.resultUnit()).param("reference_low", item.referenceLow())
                    .param("reference_high", item.referenceHigh()).param("flag", item.abnormalFlag()).update();
        } else {
            jdbc.sql("""
                    insert into clinical_result_observation(
                      tenant_id, observation_id, result_version_id, item_code, item_name, value_type,
                      text_value, abnormal_flag)
                    values (:tenant, :observation, :version, :code, :name, 'TEXT', :value, :flag)
                    on conflict (tenant_id, observation_id) do nothing
                    """).param("tenant", TENANT_ID).param("observation", observationId)
                    .param("version", resultVersionId).param("code", item.resultCode())
                    .param("name", item.resultName()).param("value", item.resultValue().stringValue())
                    .param("flag", item.abnormalFlag()).update();
        }
    }

    private void upsertOutpatientDiseaseCase(
            SyntheticDiseaseCaseCatalog.DiseaseCase item, int index, UUID patientId,
            UUID encounterId, UUID slotId) {
        UUID appointmentId = scenarioId(item.caseId(), "appointment");
        UUID queueEntryId = scenarioId(item.caseId(), "queue-entry");
        String queueStatus = outpatientQueueStatus(index);
        jdbc.sql("""
                insert into appointment(
                  tenant_id, appointment_id, schedule_slot_id, patient_id, organization_id, facility_id,
                  visit_type, source, status, booked_at, check_in_at, encounter_id)
                values (:tenant, :appointment, :slot, :patient, :org, :facility, 'OUTPATIENT',
                  'APPOINTMENT', 'CHECKED_IN', now() - interval '4 hour',
                  now() - interval '3 hour', :encounter)
                on conflict (tenant_id, appointment_id) do update set encounter_id = excluded.encounter_id,
                  status = 'CHECKED_IN', check_in_at = excluded.check_in_at, updated_at = now()
                """).param("tenant", TENANT_ID).param("appointment", appointmentId).param("slot", slotId)
                .param("patient", patientId).param("org", ORGANIZATION_ID).param("facility", FACILITY_ID)
                .param("encounter", encounterId).update();
        jdbc.sql("""
                insert into waiting_queue_entry(
                  tenant_id, waiting_queue_entry_id, appointment_id, facility_id, queue_date,
                  sequence_no, status, called_at, called_by)
                values (:tenant, :entry, :appointment, :facility, current_date, :sequence, :status,
                  case when :status = 'WAITING' then null else now() - interval '30 minute' end,
                  case when :status = 'WAITING' then null else :author end)
                on conflict (tenant_id, waiting_queue_entry_id) do update set queue_date = current_date,
                  status = excluded.status, called_at = excluded.called_at, called_by = excluded.called_by,
                  updated_at = now()
                """).param("tenant", TENANT_ID).param("entry", queueEntryId).param("appointment", appointmentId)
                .param("facility", FACILITY_ID).param("sequence", 101 + index).param("status", queueStatus)
                .param("author", USER_ID).update();
    }

    private void upsertEmergencyDiseaseCase(
            SyntheticDiseaseCaseCatalog.DiseaseCase item, int index, UUID patientId, UUID encounterId) {
        UUID triageId = scenarioId(item.caseId(), "triage");
        UUID nursingNoteId = scenarioId(item.caseId(), "emergency-nursing");
        UUID observationId = scenarioId(item.caseId(), "emergency-observation");
        boolean immediate = "LEVEL_1".equals(item.triageLevel());
        jdbc.sql("""
                insert into emergency_triage_assessment(
                  tenant_id, triage_assessment_id, patient_id, encounter_id, facility_id,
                  triage_level, chief_complaint, triaged_at, immediate_action_required, status)
                values (:tenant, :triage, :patient, :encounter, :facility, :level, :complaint,
                  now() - (:minutes * interval '1 minute'), :immediate, 'ACTIVE')
                on conflict (tenant_id, triage_assessment_id) do nothing
                """).param("tenant", TENANT_ID).param("triage", triageId).param("patient", patientId)
                .param("encounter", encounterId).param("facility", FACILITY_ID).param("level", item.triageLevel())
                .param("complaint", item.chiefComplaint()).param("minutes", 25 + index)
                .param("immediate", immediate).update();
        jdbc.sql("""
                insert into emergency_nursing_note(
                  tenant_id, note_id, patient_id, encounter_id, facility_id,
                  assessment, intervention, risk_flag, recorded_at)
                values (:tenant, :note, :patient, :encounter, :facility, :assessment,
                  :intervention, true, now() - interval '15 minute')
                on conflict (tenant_id, note_id) do nothing
                """).param("tenant", TENANT_ID).param("note", nursingNoteId).param("patient", patientId)
                .param("encounter", encounterId).param("facility", FACILITY_ID)
                .param("assessment", item.vitalSigns() + " " + item.physicalExamination())
                .param("intervention", item.treatmentPlan()).update();
        jdbc.sql("""
                insert into emergency_observation(
                  tenant_id, observation_id, patient_id, encounter_id, facility_id,
                  observation_started_at, disposition, status)
                values (:tenant, :observation, :patient, :encounter, :facility,
                  now() - interval '20 minute', 'PENDING', 'OBSERVING')
                on conflict (tenant_id, observation_id) do nothing
                """).param("tenant", TENANT_ID).param("observation", observationId).param("patient", patientId)
                .param("encounter", encounterId).param("facility", FACILITY_ID).update();
    }

    private void upsertInpatientDiseaseCase(
            SyntheticDiseaseCaseCatalog.DiseaseCase item, int index, UUID patientId, UUID encounterId) {
        UUID bedId = scenarioId(item.caseId(), "bed");
        UUID admissionId = scenarioId(item.caseId(), "admission");
        UUID occupancyId = scenarioId(item.caseId(), "bed-occupancy");
        UUID taskId = scenarioId(item.caseId(), "first-course-task");
        String bedLabel = "心血管内科-" + String.format("%02d", index + 1) + "床";
        jdbc.sql("""
                insert into clinical_bed(tenant_id, bed_id, ward_id, bed_label, status)
                values (:tenant, :bed, :ward, :label, 'ACTIVE')
                on conflict (tenant_id, bed_id) do nothing
                """).param("tenant", TENANT_ID).param("bed", bedId).param("ward", SYNTHETIC_WARD_ID)
                .param("label", bedLabel).update();
        jdbc.sql("""
                insert into inpatient_admission(
                  tenant_id, admission_id, encounter_id, patient_id, facility_id, ward_id,
                  current_bed_id, attending_user_id, status, admitted_at, admission_no, department_id,
                  admission_source, admission_type, condition_level, admitting_diagnosis_code,
                  admitting_diagnosis_text, payment_method_code, identity_verification_method,
                  contact_name, contact_relationship, contact_phone, remarks)
                values (:tenant, :admission, :encounter, :patient, :facility, :ward,
                  :bed, :attending, 'ADMITTED', now() - (:hours * interval '1 hour'),
                  :admission_no, :department, :admission_source, :admission_type, :condition_level,
                  :diagnosis_code, :diagnosis_text, 'URBMI', 'RESIDENT_ID', :contact_name,
                  :contact_relationship, :contact_phone, :remarks)
                on conflict (tenant_id, admission_id) do update
                set admission_no = excluded.admission_no, department_id = excluded.department_id,
                  admission_source = excluded.admission_source, admission_type = excluded.admission_type,
                  condition_level = excluded.condition_level,
                  admitting_diagnosis_code = excluded.admitting_diagnosis_code,
                  admitting_diagnosis_text = excluded.admitting_diagnosis_text,
                  contact_name = excluded.contact_name, contact_relationship = excluded.contact_relationship,
                  contact_phone = excluded.contact_phone, remarks = excluded.remarks
                """).param("tenant", TENANT_ID).param("admission", admissionId).param("encounter", encounterId)
                .param("patient", patientId).param("facility", FACILITY_ID).param("ward", SYNTHETIC_WARD_ID)
                .param("bed", bedId).param("attending", USER_ID).param("hours", 12 + index)
                .param("admission_no", "IP-SYN50-" + item.caseId().substring(item.caseId().length() - 3))
                .param("department", SYNTHETIC_DEPARTMENT_ID)
                .param("admission_source", index % 3 == 0 ? "EMERGENCY" : "OUTPATIENT")
                .param("admission_type", index % 3 == 0 ? "EMERGENCY" : "URGENT")
                .param("condition_level", index % 5 == 0 ? "CRITICAL" : index % 2 == 0 ? "SERIOUS" : "GENERAL")
                .param("diagnosis_code", item.diseaseCode()).param("diagnosis_text", item.diagnosisText())
                .param("contact_name", item.patientName().substring(0, 1) + ("F".equals(item.sex()) ? "秀英" : "建军"))
                .param("contact_relationship", "F".equals(item.sex()) ? "母亲" : "父亲")
                .param("contact_phone", "138" + String.format("%08d", 10000000 + index))
                .param("remarks", item.treatmentPlan()).update();
        jdbc.sql("""
                insert into bed_occupancy(
                  tenant_id, bed_occupancy_id, admission_id, ward_id, bed_id, started_at)
                values (:tenant, :occupancy, :admission, :ward, :bed,
                  now() - (:hours * interval '1 hour'))
                on conflict (tenant_id, bed_occupancy_id) do nothing
                """).param("tenant", TENANT_ID).param("occupancy", occupancyId).param("admission", admissionId)
                .param("ward", SYNTHETIC_WARD_ID).param("bed", bedId).param("hours", 12 + index).update();

        var courseSections = objectMapper.createObjectNode();
        courseSections.put("case_features", item.presentIllness() + " " + item.physicalExamination());
        courseSections.put("provisional_diagnosis", item.diagnosisText());
        courseSections.put("diagnostic_evidence", item.evidenceSummary());
        courseSections.put("risk_assessment", item.vitalSigns());
        courseSections.put("treatment_plan", item.treatmentPlan());
        courseSections.put("course_summary", "入院后已完成首轮评估、关键检查和风险分层，继续按计划动态复核。");
        upsertDiseaseCaseDocument(item, patientId, encounterId, "first-course-document",
                "WS445.5.FIRST_COURSE_RECORD", courseSections);
        jdbc.sql("""
                insert into inpatient_document_task(
                  tenant_id, task_id, admission_id, document_type_code, task_state, due_at,
                  occurrence_key, rule_version, required_signature_level)
                values (:tenant, :task, :admission, 'WS445.5.FIRST_COURSE_RECORD', 'PENDING',
                  now() + interval '4 hour', 'SYNTHETIC-50', 1,
                  (select required_signature_level from inpatient_document_rule
                   where tenant_id = :tenant and document_type_code = 'WS445.5.FIRST_COURSE_RECORD'
                     and rule_version = 1 order by rule_code limit 1))
                on conflict (tenant_id, task_id) do nothing
                """).param("tenant", TENANT_ID).param("task", taskId).param("admission", admissionId).update();
    }

    private static String documentType(String domain) {
        return switch (domain) {
            case "OUTPATIENT" -> "WS445.2.OUTPATIENT_RECORD";
            case "EMERGENCY" -> "WS445.3.EMERGENCY_RECORD";
            case "INPATIENT" -> "WS445.12.ADMISSION_NOTE";
            default -> throw new IllegalArgumentException("Unsupported disease case domain: " + domain);
        };
    }

    private static String encounterStatus(String domain, int index) {
        if (!"OUTPATIENT".equals(domain)) return "IN_PROGRESS";
        return "IN_CONSULTATION".equals(outpatientQueueStatus(index)) ? "IN_PROGRESS" : "ARRIVED";
    }

    private static String outpatientQueueStatus(int index) {
        return switch (index % 3) {
            case 0 -> "WAITING";
            case 1 -> "CALLED";
            default -> "IN_CONSULTATION";
        };
    }

    private static UUID scenarioId(String caseId, String resource) {
        return UUID.nameUUIDFromBytes(("openemr2026:synthetic-50:" + caseId + ":" + resource)
                .getBytes(StandardCharsets.UTF_8));
    }

    private static String syntheticHash(String value) {
        String compact = UUID.nameUUIDFromBytes(value.getBytes(StandardCharsets.UTF_8))
                .toString().replace("-", "");
        return compact + compact;
    }

    private void upsertInpatientFixture() {
        UUID patientId = UUID.fromString("018f0000-0000-7000-8000-000000000002");
        UUID encounterId = UUID.fromString("018f0000-0000-7000-8000-000000000102");
        OffsetDateTime admittedAt = OffsetDateTime.parse("2026-08-13T16:10:00+08:00");
        jdbc.sql("""
                insert into clinical_department(
                  tenant_id, facility_id, department_id, department_code, display_name, status, unit_type)
                values (:tenant, :facility, :department, 'CARDIOLOGY', '心血管内科', 'ACTIVE', 'DEPARTMENT')
                on conflict (tenant_id, facility_id, department_id) do update
                set department_code = excluded.department_code, display_name = excluded.display_name, status = 'ACTIVE'
                """).param("tenant", TENANT_ID).param("facility", FACILITY_ID)
                .param("department", SYNTHETIC_DEPARTMENT_ID).update();
        jdbc.sql("""
                insert into clinical_ward(
                  tenant_id, facility_id, department_id, ward_id, ward_code, display_name, status)
                values (:tenant, :facility, :department, :ward, 'CARDIO-1', '心血管内科一病区', 'ACTIVE')
                on conflict (tenant_id, ward_id) do update
                set department_id = excluded.department_id, ward_code = excluded.ward_code,
                  display_name = excluded.display_name, status = 'ACTIVE'
                """).param("tenant", TENANT_ID).param("facility", FACILITY_ID)
                .param("department", SYNTHETIC_DEPARTMENT_ID)
                .param("ward", SYNTHETIC_WARD_ID).update();
        for (int number = 1; number <= 12; number++) {
            UUID bedId = number == 2 ? SYNTHETIC_BED_ID : number == 3 ? SYNTHETIC_FREE_BED_ID
                    : UUID.nameUUIDFromBytes(("cardiology-bed-" + number).getBytes(StandardCharsets.UTF_8));
            jdbc.sql("""
                    insert into clinical_bed(tenant_id, bed_id, ward_id, bed_label, status)
                    values (:tenant, :bed, :ward, :label, 'ACTIVE')
                    on conflict (tenant_id, bed_id) do update
                    set ward_id = excluded.ward_id, bed_label = excluded.bed_label, status = 'ACTIVE'
                    """).param("tenant", TENANT_ID).param("bed", bedId).param("ward", SYNTHETIC_WARD_ID)
                    .param("label", "心血管内科-" + String.format("%02d", number) + "床").update();
        }
        jdbc.sql("""
                update workforce_assignment set department_id = :department, ward_id = :ward,
                  position_code = case when position_code = 'CLINICIAN' then 'ATTENDING_PHYSICIAN' else position_code end,
                  updated_at = now(), row_version = row_version + 1
                where tenant_id = :tenant and source_role_assignment_id in (:clinician, :attending, :chief)
                  and (department_id is distinct from :department or ward_id is distinct from :ward)
                """).param("department", SYNTHETIC_DEPARTMENT_ID).param("ward", SYNTHETIC_WARD_ID)
                .param("tenant", TENANT_ID).param("clinician", ROLE_ASSIGNMENT_ID)
                .param("attending", ATTENDING_ROLE_ID).param("chief", CHIEF_ROLE_ID).update();
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
                  current_bed_id, attending_user_id, status, admitted_at, admission_no, department_id,
                  admission_source, admission_type, condition_level, admitting_diagnosis_code,
                  admitting_diagnosis_text, payment_method_code, identity_verification_method,
                  contact_name, contact_relationship, contact_phone, admission_certificate_no, remarks)
                values (:tenant, :admission, :encounter, :patient, :facility, :ward,
                  :bed, :attending, 'ADMITTED', :admitted_at, 'IP-20260813-0002', :department,
                  'OUTPATIENT', 'ELECTIVE', 'GENERAL', 'I50.9', '慢性心力衰竭急性加重',
                  'URBMI', 'RESIDENT_ID', '张敏', '配偶', '13800138002', 'RYZ-20260813-002',
                  '门诊评估后收入心血管内科继续治疗')
                on conflict (tenant_id, admission_id) do update
                set department_id = excluded.department_id, admission_no = excluded.admission_no,
                  admitting_diagnosis_text = excluded.admitting_diagnosis_text,
                  contact_name = excluded.contact_name, contact_relationship = excluded.contact_relationship,
                  contact_phone = excluded.contact_phone
                """).param("tenant", TENANT_ID).param("admission", SYNTHETIC_ADMISSION_ID)
                .param("encounter", encounterId).param("patient", patientId).param("facility", FACILITY_ID)
                .param("ward", SYNTHETIC_WARD_ID).param("bed", SYNTHETIC_BED_ID)
                .param("attending", USER_ID).param("department", SYNTHETIC_DEPARTMENT_ID)
                .param("admitted_at", admittedAt).update();
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
        upsertInpatientTask("018f0000-0000-7000-8000-00000000bb08", "EMR.FOUR_LEVEL_REVIEW",
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

    private void refreshPlaceholderPatientProfiles() {
        List<PlaceholderPatient> patients = jdbc.sql("""
                select patient.patient_id, patient.sex_code, patient.birth_date
                from patient
                where patient.tenant_id = :tenant
                  and patient.patient_id not in (
                    '018f0000-0000-7000-8000-000000000001'::uuid,
                    '018f0000-0000-7000-8000-000000000002'::uuid,
                    '018f0000-0000-7000-8000-000000000003'::uuid,
                    '018f0000-0000-7000-8000-000000000004'::uuid,
                    '018f0000-0000-7000-8000-000000000005'::uuid,
                    '018f0000-0000-7000-8000-000000000006'::uuid)
                  and not exists (
                    select 1 from encounter canonical
                    where canonical.tenant_id = patient.tenant_id
                      and canonical.patient_id = patient.patient_id
                      and canonical.source_system in ('SYNTHETIC', 'SYNTHETIC-50'))
                  and (
                    patient.display_name ~* '(合成|测试|患者|synthetic|patient|demo|sample)'
                    or exists (
                      select 1 from encounter generated
                      where generated.tenant_id = patient.tenant_id
                        and generated.patient_id = patient.patient_id
                        and (generated.source_system like 'SYNTHETIC-%'
                          or generated.source_system in (
                            'OPENEMR2026-TEST', 'OPENEMR2026-APPOINTMENT', 'ARCHIVE-TEST'))))
                order by patient.patient_id
                """)
                .param("tenant", TENANT_ID)
                .query((resultSet, rowNumber) -> new PlaceholderPatient(
                        resultSet.getObject("patient_id", UUID.class), resultSet.getString("sex_code"),
                        resultSet.getObject("birth_date", LocalDate.class)))
                .list();
        for (PlaceholderPatient patient : patients) {
            String sex = normalizeSyntheticSex(patient.sexCode());
            if (!"M".equals(sex) && !"F".equals(sex)) {
                sex = (patient.patientId().getLeastSignificantBits() & 1L) == 0L ? "M" : "F";
            }
            jdbc.sql("""
                    update patient
                    set display_name = :name, sex_code = :sex, birth_date = :birth_date, updated_at = now(),
                      row_version = row_version + 1
                    where tenant_id = :tenant and patient_id = :patient
                      and (display_name, sex_code, birth_date)
                        is distinct from (:name, :sex, :birth_date)
                    """)
                    .param("name", realisticPatientName(patient.patientId(), sex))
                    .param("sex", sex).param("birth_date", realisticBirthDate(patient.patientId(), patient.birthDate()))
                    .param("tenant", TENANT_ID).param("patient", patient.patientId()).update();
        }
    }

    static String realisticPatientName(UUID patientId, String sexCode) {
        String[] surnames = {
            "王", "李", "张", "刘", "陈", "杨", "黄", "赵", "吴", "周",
            "徐", "孙", "马", "朱", "胡", "郭", "何", "高", "林", "罗",
            "郑", "梁", "谢", "宋", "唐", "许", "韩", "冯", "邓", "曹",
            "彭", "曾", "肖", "田", "董", "袁", "潘", "于", "蒋", "蔡",
            "余", "杜", "叶", "程", "苏", "魏", "吕", "丁", "任", "沈"
        };
        String[] firstNames = "F".equals(sexCode)
                ? new String[]{"静", "晓", "雅", "雨", "欣", "婉", "思", "佳", "慧", "丽",
                    "雪", "梦", "若", "安", "芷", "依", "淑", "秀", "素", "美",
                    "怡", "清", "敏", "悦", "晨", "月", "丹", "琴", "兰", "桂"}
                : new String[]{"志", "建", "明", "浩", "国", "俊", "子", "庆", "伟", "振",
                    "德", "宇", "福", "凯", "天", "长", "文", "嘉", "海", "泽",
                    "宏", "正", "启", "景", "承", "博", "瑞", "东", "华", "远"};
        String[] secondNames = "F".equals(sexCode)
                ? new String[]{"敏", "怡", "桐", "然", "彤", "琴", "琪", "清", "兰", "芬",
                    "华", "英", "悦", "曦", "琳", "芳", "梅", "娜", "珍", "涵",
                    "洁", "宁", "妍", "晴", "茹", "菲", "蓉", "瑶", "璇", "颖"}
                : new String[]{"远", "国", "轩", "强", "然", "墨", "杰", "华", "胜", "航",
                    "林", "凯", "佑", "青", "博", "诚", "峰", "鹏", "平", "辰",
                    "宇", "伟", "豪", "瑞", "涛", "宁", "健", "斌", "成", "毅"};
        long seed = mix64(patientId.getMostSignificantBits() ^ Long.rotateLeft(
                patientId.getLeastSignificantBits(), 29));
        long firstSeed = mix64(seed + 0x9E3779B97F4A7C15L);
        long secondSeed = mix64(firstSeed + 0x9E3779B97F4A7C15L);
        return surnames[(int) Math.floorMod(seed, surnames.length)]
                + firstNames[(int) Math.floorMod(firstSeed, firstNames.length)]
                + secondNames[(int) Math.floorMod(secondSeed, secondNames.length)];
    }

    static String normalizeSyntheticSex(String sexCode) {
        if (sexCode == null) return "U";
        return switch (sexCode) {
            case "1" -> "M";
            case "2" -> "F";
            default -> sexCode;
        };
    }

    static LocalDate realisticBirthDate(UUID patientId, LocalDate currentBirthDate) {
        if (currentBirthDate == null) return LocalDate.of(1980, 1, 1);
        LocalDate today = LocalDate.now();
        int year = Math.min(currentBirthDate.getYear(), today.getYear());
        int hash = patientId.hashCode();
        if (year == today.getYear()) {
            return LocalDate.ofYearDay(year, 1 + Math.floorMod(hash, today.getDayOfYear()));
        }
        int month = 1 + Math.floorMod(Integer.rotateLeft(hash, 7), 12);
        int day = 1 + Math.floorMod(Integer.rotateLeft(hash, 17),
                YearMonth.of(year, month).lengthOfMonth());
        return LocalDate.of(year, month, day);
    }

    private static long mix64(long value) {
        value = (value ^ (value >>> 30)) * 0xBF58476D1CE4E5B9L;
        value = (value ^ (value >>> 27)) * 0x94D049BB133111EBL;
        return value ^ (value >>> 31);
    }

    private record PlaceholderPatient(UUID patientId, String sexCode, LocalDate birthDate) {}

    private record SyntheticTemplate(String documentTypeCode, String displayName, JsonNode sections) {}
}
