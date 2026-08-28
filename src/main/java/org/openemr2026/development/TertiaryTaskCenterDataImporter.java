package org.openemr2026.development;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Profile;
import org.springframework.context.event.EventListener;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

/** Imports persisted task-center workload and executable pathway templates for development. */
@Component
@Profile("dev-synthetic")
final class TertiaryTaskCenterDataImporter {
    private static final UUID TENANT_ID = SyntheticDataImporter.TENANT_ID;
    private static final UUID FACILITY_ID = SyntheticDataImporter.FACILITY_ID;
    private static final UUID DEPARTMENT_ID = SyntheticDataImporter.SYNTHETIC_DEPARTMENT_ID;
    private static final UUID WARD_ID = SyntheticDataImporter.SYNTHETIC_WARD_ID;
    private static final UUID USER_ID = SyntheticDataImporter.USER_ID;
    private static final UUID APPROVER_ID = SyntheticDataImporter.COLLABORATOR_USER_ID;
    private static final String RESOURCE = "synthetic/tertiary-task-center-v2.json";

    private final JdbcClient jdbc;
    private final TransactionTemplate transactions;
    private final ObjectMapper objectMapper;

    TertiaryTaskCenterDataImporter(JdbcClient jdbc, TransactionTemplate transactions, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.transactions = transactions;
        this.objectMapper = objectMapper;
    }

    @EventListener(ApplicationReadyEvent.class)
    void importData() {
        JsonNode dataset = readDataset();
        transactions.executeWithoutResult(status -> {
            seedTaskRules(dataset);
            seedPathwayCatalogAndRules(dataset);
            seedOperationalTasks();
            seedTaskEvents();
            seedTeamQueue();
            seedNotifications();
        });
    }

    private JsonNode readDataset() {
        try (var input = new ClassPathResource(RESOURCE).getInputStream()) {
            JsonNode root = objectMapper.readTree(input);
            if (!root.path("task_rules").isArray() || root.path("task_rules").size() < 8
                    || !root.path("pathways").isArray() || root.path("pathways").size() < 8) {
                throw new IllegalStateException("Tertiary task-center dataset is incomplete");
            }
            return root;
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to load " + RESOURCE, exception);
        }
    }

    private void seedTaskRules(JsonNode dataset) {
        for (JsonNode rule : dataset.path("task_rules")) {
            String key = required(rule, "key");
            var payload = objectMapper.createObjectNode();
            payload.put("schema_version", 1);
            payload.put("fixture_source", "tertiary-task-center-v2");
            payload.put("dataset_version", required(dataset, "dataset_version"));
            payload.put("hospital_level", required(dataset, "hospital_level"));
            payload.put("task_type", required(rule, "task_type"));
            payload.put("risk_level", required(rule, "risk_level"));
            payload.put("due_minutes", rule.path("due_minutes").asInt());
            payload.put("escalation_minutes", rule.path("escalation_minutes").asInt());
            payload.put("assignment_strategy", required(rule, "assignment_strategy"));
            payload.put("completion_source", "权威业务对象终态");
            payload.set("applies_to", rule.path("applies_to"));
            payload.putArray("channels").add("IN_APP").add("OUTBOX");
            payload.put("enabled", true);
            upsertConfig("CLINICAL_TASK_RULE", key, required(rule, "name"), payload);
        }
    }

    private void seedPathwayCatalogAndRules(JsonNode dataset) {
        for (JsonNode pathway : dataset.path("pathways")) {
            String code = required(pathway, "code");
            UUID definitionId = id("pathway-definition:" + code);
            UUID versionId = id("pathway-version:" + code + ":" + pathway.path("version").asInt());
            ObjectNode payload = ((ObjectNode) pathway).deepCopy();
            payload.put("schema_version", 1);
            payload.put("fixture_source", "tertiary-task-center-v2");
            payload.put("dataset_version", required(dataset, "dataset_version"));
            payload.put("hospital_level", required(dataset, "hospital_level"));
            payload.put("pathway_code", code);
            payload.put("specialty_code", required(pathway, "specialty"));
            payload.put("diagnosis_code", required(pathway, "diagnosis"));
            payload.put("version_no", pathway.path("version").asInt());
            payload.put("publication_scope", "江城大学附属医院本部");
            payload.put("version_immutable_after_publish", true);
            payload.set("variance_rules", dataset.path("variance_rules"));
            payload.set("completion_rules", dataset.path("completion_rules"));
            payload.set("exit_rules", dataset.path("exit_rules"));
            upsertConfig("CLINICAL_PATHWAY", required(pathway, "config_key"), required(pathway, "name"), payload);

            jdbc.sql("""
                    insert into clinical_pathway_definition(
                      tenant_id, pathway_definition_id, pathway_code, display_name, specialty_code,
                      diagnosis_code, status, created_by, created_at)
                    values (:tenant, :definition, :code, :name, :specialty, :diagnosis,
                      'ACTIVE', :author, now() - interval '45 days')
                    on conflict (tenant_id, pathway_code) do nothing
                    """).param("tenant", TENANT_ID).param("definition", definitionId).param("code", code)
                    .param("name", required(pathway, "name")).param("specialty", required(pathway, "specialty"))
                    .param("diagnosis", required(pathway, "diagnosis")).param("author", USER_ID).update();
            jdbc.sql("""
                    insert into clinical_pathway_version(
                      tenant_id, pathway_version_id, pathway_definition_id, version_no, status,
                      admission_criteria, created_by, approved_by, created_at, published_at)
                    values (:tenant, :version, :definition, :version_no, 'PUBLISHED', :criteria,
                      :author, :approver, now() - interval '40 days', now() - interval '30 days')
                    on conflict (tenant_id, pathway_definition_id, version_no) do nothing
                    """).param("tenant", TENANT_ID).param("version", versionId).param("definition", definitionId)
                    .param("version_no", pathway.path("version").asInt())
                    .param("criteria", required(pathway, "admission_criteria"))
                    .param("author", USER_ID).param("approver", APPROVER_ID).update();

            int stageSequence = 0;
            for (JsonNode stage : pathway.path("stages")) {
                stageSequence++;
                String stageCode = required(stage, "code");
                jdbc.sql("""
                        insert into clinical_pathway_stage(
                          tenant_id, pathway_version_id, stage_code, display_name, sequence_no,
                          expected_day_start, expected_day_end)
                        values (:tenant, :version, :code, :name, :sequence, :day_start, :day_end)
                        on conflict (tenant_id, pathway_version_id, stage_code) do nothing
                        """).param("tenant", TENANT_ID).param("version", versionId).param("code", stageCode)
                        .param("name", required(stage, "name")).param("sequence", stageSequence)
                        .param("day_start", stage.path("start").asInt()).param("day_end", stage.path("end").asInt()).update();
                int taskSequence = 0;
                for (JsonNode task : stage.path("tasks")) {
                    taskSequence++;
                    jdbc.sql("""
                            insert into clinical_pathway_stage_task(
                              tenant_id, pathway_version_id, stage_code, task_code, display_name,
                              source_type, source_key, required, sequence_no)
                            values (:tenant, :version, :stage, :task_code, :name,
                              :source_type, :source_key, :required, :sequence)
                            on conflict (tenant_id, pathway_version_id, task_code) do nothing
                            """).param("tenant", TENANT_ID).param("version", versionId).param("stage", stageCode)
                            .param("task_code", task.path(0).stringValue()).param("name", task.path(1).stringValue())
                            .param("source_type", task.path(2).stringValue()).param("source_key", task.path(3).stringValue())
                            .param("required", task.path(4).asBoolean()).param("sequence", taskSequence).update();
                }
            }
        }
    }

    private void upsertConfig(String type, String key, String name, JsonNode payload) {
        jdbc.sql("""
                insert into config_item(
                  tenant_id, config_id, config_type, config_key, display_name, payload,
                  status, row_version, schema_version, validation_state, validation_errors,
                  approval_state, approved_by, published_at, created_by)
                values (:tenant, :id, :type, :key, :name, cast(:payload as jsonb),
                  'ACTIVE', 1, 1, 'VALID', '[]'::jsonb, 'APPROVED', :approver,
                  now() - interval '30 days', :author)
                on conflict (tenant_id, config_type, config_key) do update set
                  display_name = excluded.display_name, payload = excluded.payload,
                  status = 'ACTIVE', validation_state = 'VALID', validation_errors = '[]'::jsonb,
                  approval_state = 'APPROVED', approved_by = excluded.approved_by,
                  published_at = coalesce(config_item.published_at, excluded.published_at),
                  updated_at = now(), row_version = config_item.row_version + 1
                where config_item.display_name is distinct from excluded.display_name
                   or config_item.payload is distinct from excluded.payload
                   or config_item.status <> 'ACTIVE'
                """).param("tenant", TENANT_ID).param("id", id("config:" + type + ":" + key))
                .param("type", type).param("key", key).param("name", name)
                .param("payload", payload.toString()).param("approver", APPROVER_ID).param("author", USER_ID).update();
    }

    private void seedOperationalTasks() {
        jdbc.sql("""
                with seed as (
                  select * from (values
                    (1,'inpatient','CRITICAL_VALUE','TCV2_SEPSIS_BUNDLE','脓毒症一小时集束化处置','CRITICAL','IN_PROGRESS','复苏目标动态复评中','/ip-pathway',45),
                    (2,'inpatient','DOCUMENT','TCV2_VTE_ASSESSMENT','住院24小时VTE风险评估','HIGH','CLAIMED','主管医师已接手','/inpatient-course',360),
                    (3,'inpatient','ORDER_EXECUTION','TCV2_ANTIMICROBIAL_REVIEW','抗菌药物72小时再评估','HIGH','CLAIMED','等待病原学结果与疗效复核','/orders',600),
                    (4,'inpatient','PATHWAY','TCV2_PATHWAY_VARIANCE','临床路径变异原因审核','HIGH','IN_PROGRESS','路径管理员审核中','/ip-pathway',90),
                    (5,'inpatient','DOCUMENT','TCV2_DISCHARGE_MED_REC','出院用药重整与教育','HIGH','PENDING','待医师与药师联合核对','/discharge',480),
                    (6,'inpatient','ORDER_EXECUTION','TCV2_TRANSFUSION_OBS','输血开始后不良反应监测','CRITICAL','ASSIGNED','责任护士已接收监测任务','/blood-transfusion',15),
                    (7,'inpatient','DOCUMENT','TCV2_SURGERY_TIMEOUT','手术安全核查三方确认','CRITICAL','VIEWED','已查看，等待三方共同确认','/surgery',30),
                    (8,'inpatient','DOCUMENT','TCV2_PRESSURE_INJURY','压疮风险复评与护理措施','HIGH','PENDING','待责任护士复评','/nursing',240),
                    (9,'inpatient','DISCHARGE_REMEDIATION','TCV2_RECORD_QC','出院病案首页质控整改','ROUTINE','PENDING','病案质控规则命中待整改','/record-center',1440),
                    (10,'inpatient','CONSULTATION','TCV2_MDT_CONSULT','疑难病例多学科会诊准备','HIGH','ASSIGNED','资料汇总与参会确认中','/consultations',720),
                    (11,'outpatient','CRITICAL_VALUE','TCV2_TROPONIN','高敏肌钙蛋白危急值回读','CRITICAL','IN_PROGRESS','已电话回读，等待临床处置闭环','/diagnostics/lab',15),
                    (12,'outpatient','DOCUMENT','TCV2_CHRONIC_FOLLOWUP','高血压分级管理随访计划','ROUTINE','CLAIMED','主管医师制定随访计划中','/outpatient-followup',1440),
                    (13,'outpatient','ORDER_EXECUTION','TCV2_IMAGING_REVIEW','胸部CT异常结果复核','HIGH','PENDING','待门诊医师解释与转诊评估','/diagnostics/imaging',120),
                    (14,'outpatient','AI_APPROVAL','TCV2_AI_MED_REVIEW','智能用药建议人工复核','HIGH','VIEWED','AI建议仅供参考，等待医师确认','/ai-approval',60),
                    (15,'outpatient','CONSULTATION','TCV2_REFERRAL','专科转诊资料完整性核验','ROUTINE','ASSIGNED','转诊资料待补全','/referrals',480),
                    (16,'outpatient','DOCUMENT','TCV2_DIABETES_EDU','糖尿病门诊自我管理教育','ROUTINE','CLAIMED','教育护士已接手','/outpatient-followup',720)
                  ) v(ordinal, domain, source_type, task_type, title, risk_level, state, business_state, source_route, due_minutes)
                ), context as (
                  select s.*,
                    case when domain='inpatient' then '018f0000-0000-7000-8000-000000000002'::uuid
                         else '018f0000-0000-7000-8000-000000000001'::uuid end patient_id,
                    case when domain='inpatient' then '018f0000-0000-7000-8000-000000000102'::uuid
                         else '018f0000-0000-7000-8000-000000000101'::uuid end encounter_id,
                    md5('tertiary-task-center-v2:task:' || ordinal)::uuid task_id,
                    md5('tertiary-task-center-v2:source:' || ordinal)::uuid source_id
                  from seed s
                )
                insert into clinical_task(
                  tenant_id, task_id, patient_id, encounter_id, facility_id, ward_id,
                  source_type, source_id, task_type, title, risk_level, state, business_state,
                  assigned_user_id, claimed_by, due_at, source_route, row_version, created_at, updated_at)
                select :tenant, task_id, patient_id, encounter_id, :facility,
                  case when domain='inpatient' then :ward else null end,
                  source_type, source_id, task_type, title, risk_level, state, business_state,
                  :author, case when state in ('CLAIMED','IN_PROGRESS') then :author else null end,
                  now() + due_minutes * interval '1 minute', source_route, 1,
                  now() - (ordinal * 17) * interval '1 minute', now() - (ordinal * 5) * interval '1 minute'
                from context on conflict (tenant_id, source_type, source_id, task_type) do nothing
                """).param("tenant", TENANT_ID).param("facility", FACILITY_ID)
                .param("ward", WARD_ID).param("author", USER_ID).update();
    }

    private void seedTaskEvents() {
        jdbc.sql("""
                insert into clinical_task_event(
                  tenant_id, task_event_id, task_id, event_type, previous_state,
                  resulting_state, actor_user_id, reason, occurred_at)
                select :tenant, md5('tertiary-task-center-v2:event:' || task_id)::uuid,
                  task_id, 'CREATED', null, state, :author,
                  '由三级医院业务规则生成的仿真任务', created_at
                from clinical_task
                where tenant_id=:tenant and task_type like 'TCV2_%'
                on conflict (tenant_id, task_event_id) do nothing
                """).param("tenant", TENANT_ID).param("author", USER_ID).update();
    }

    private void seedTeamQueue() {
        jdbc.sql("""
                with ranked as (
                  select task_id, row_number() over(order by created_at, task_id) ordinal
                  from clinical_task where tenant_id=:tenant and task_type like 'TCV2_%'
                    and encounter_id='018f0000-0000-7000-8000-000000000102'::uuid
                )
                insert into clinical_task_team_queue(
                  tenant_id, queue_id, facility_id, department_id, clinical_task_id,
                  queue_status, enqueued_by, enqueued_at, claimed_by, claimed_at, row_version)
                select :tenant, md5('tertiary-task-center-v2:queue:' || task_id)::uuid,
                  :facility, :department, task_id,
                  case when ordinal % 3=0 then 'COMPLETED' when ordinal % 2=0 then 'CLAIMED' else 'ENQUEUED' end,
                  :author, now()-(ordinal*13)*interval '1 minute',
                  case when ordinal % 3=0 or ordinal % 2=0 then :author else null end,
                  case when ordinal % 3=0 or ordinal % 2=0 then now()-(ordinal*8)*interval '1 minute' else null end,
                  case when ordinal % 3=0 or ordinal % 2=0 then 2 else 1 end
                from ranked
                on conflict (tenant_id, queue_id) do nothing
                """).param("tenant", TENANT_ID).param("facility", FACILITY_ID)
                .param("department", DEPARTMENT_ID).param("author", USER_ID).update();
    }

    private void seedNotifications() {
        jdbc.sql("""
                with kinds as (
                  select * from (values
                    (1,'CREATED','IN_APP','DELIVERED',1),
                    (2,'ESCALATED','OUTBOX','PENDING',0),
                    (3,'OVERDUE','IN_APP','FAILED',2)
                  ) v(ordinal,kind,channel,status,attempt_count)
                )
                insert into clinical_task_notification(
                  tenant_id, notification_id, task_id, recipient_user_id, kind, channel,
                  status, attempt_count, delivered_at, last_error, row_version,
                  created_at, updated_at, scheduled_at)
                select :tenant, md5('tertiary-task-center-v2:notification:' || task.task_id || ':' || kinds.ordinal)::uuid,
                  task.task_id, case when kinds.ordinal=2 then :collaborator else :author end,
                  kinds.kind, kinds.channel, kinds.status, kinds.attempt_count,
                  case when kinds.status='DELIVERED' then now()-interval '12 minutes' else null end,
                  case when kinds.status='FAILED' then '院内消息网关应答超时，已保留幂等重试证据' else null end,
                  case when kinds.status='PENDING' then 1 else 2 end,
                  task.created_at, now()-interval '5 minutes',
                  case when kinds.status='PENDING' then now()+interval '10 minutes' else task.created_at end
                from clinical_task task cross join kinds
                where task.tenant_id=:tenant and task.task_type like 'TCV2_%'
                on conflict (tenant_id, notification_id) do nothing
                """).param("tenant", TENANT_ID).param("author", USER_ID).param("collaborator", APPROVER_ID).update();
    }

    private static UUID id(String key) {
        return UUID.nameUUIDFromBytes(("openemr2026:tertiary-task-center-v2:" + key)
                .getBytes(StandardCharsets.UTF_8));
    }

    private static String required(JsonNode node, String field) {
        JsonNode fieldValue = node.path(field);
        if (!fieldValue.isString() || fieldValue.stringValue().isBlank()) {
            throw new IllegalStateException("Missing task-center dataset field: " + field);
        }
        String value = fieldValue.stringValue().trim();
        return value;
    }
}
