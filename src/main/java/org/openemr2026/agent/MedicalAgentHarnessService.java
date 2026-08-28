package org.openemr2026.agent;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.openemr2026.security.ClinicalIdentity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

@Service
final class MedicalAgentHarnessService {

    private static final Set<String> TARGET_TYPES = Set.of("ENCOUNTER", "DOCUMENT", "RESULT", "TASK", "CARE_PLAN");
    private static final Set<String> AUTHORIZATION_LEVELS = Set.of("READ_ONLY", "STANDARD", "EXTENDED");
    private static final Set<String> CONTEXT_SCOPES = Set.of("RECORDS", "ORDERS", "RESULTS", "TASKS", "ATTACHMENTS");

    private final JdbcClient jdbc;
    private final TransactionTemplate transactions;
    private final ObjectMapper objectMapper;

    MedicalAgentHarnessService(JdbcClient jdbc, TransactionTemplate transactions, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.transactions = transactions;
        this.objectMapper = objectMapper;
    }

    List<AgentFamilyView> catalog() {
        List<AgentReleaseRow> rows = jdbc.sql("""
                select release.agent_code, release.release_version, release.display_name, release.agent_level,
                  release.parent_agent_code, release.stage_code, release.description, release.display_role,
                  release.current_action, release.contribution_label, release.output_schema,
                  release.autonomy_level, release.max_steps, release.max_tool_calls, release.max_duration_seconds,
                  coalesce(jsonb_agg(example.question_text order by example.example_order)
                    filter (where example.question_text is not null), '[]'::jsonb)::text as question_examples
                from medical_agent_release release
                left join medical_agent_question_example example
                  on example.agent_code = release.agent_code
                 and example.release_version = release.release_version
                where release.status = 'ACTIVE'
                group by release.agent_code, release.release_version, release.display_name, release.agent_level,
                  release.parent_agent_code, release.stage_code, release.description, release.display_role,
                  release.current_action, release.contribution_label, release.output_schema,
                  release.autonomy_level, release.max_steps, release.max_tool_calls, release.max_duration_seconds
                order by case when release.agent_level = 'MAIN' then 0 else 1 end,
                  release.parent_agent_code, release.stage_code, release.agent_code
                """).query((rs, row) -> new AgentReleaseRow(
                        rs.getString("agent_code"), rs.getString("release_version"), rs.getString("display_name"),
                        rs.getString("agent_level"), rs.getString("parent_agent_code"), rs.getString("stage_code"),
                        rs.getString("description"), rs.getString("display_role"), rs.getString("current_action"),
                        rs.getString("contribution_label"), rs.getString("output_schema"),
                        rs.getString("autonomy_level"), rs.getInt("max_steps"), rs.getInt("max_tool_calls"),
                        rs.getInt("max_duration_seconds"), listOfStrings(rs.getString("question_examples")))).list();
        Map<String, List<AgentReleaseView>> children = new LinkedHashMap<>();
        rows.stream().filter(row -> "CHILD".equals(row.level())).forEach(row ->
                children.computeIfAbsent(row.parentCode(), ignored -> new ArrayList<>()).add(view(row)));
        return rows.stream().filter(row -> "MAIN".equals(row.level()))
                .map(row -> new AgentFamilyView(view(row), List.copyOf(children.getOrDefault(row.code(), List.of()))))
                .toList();
    }

    RunView createAndRun(ClinicalIdentity identity, String idempotencyKey, CreateRunCommand command) {
        validate(command);
        UUID runId = transactions.execute(status -> {
            LeaseRow lease = lease(identity, command);
            validateTarget(identity.tenantId(), command);
            MainReleaseRow main = main(command.mainAgentCode());
            ActiveBudget budget = ensureGovernanceReady(identity.tenantId(), main.agentCode());
            ModelSelection model = resolveModel(identity.tenantId(), command.modelDeploymentId());
            List<NodeRow> nodes = nodes(main.compositionCode(), command.stageCode());
            if (nodes.isEmpty()) {
                throw new AgentRunException("AGENT_STAGE_UNSUPPORTED", 409,
                        "The selected main agent has no approved child for this clinical stage");
            }
            String requestHash = sha256(command.contextLeaseId() + "|" + command.mainAgentCode() + "|"
                    + command.stageCode() + "|" + command.targetType() + "|" + command.targetId() + "|"
                    + command.objective() + "|" + model.deploymentId() + "|" + command.authorizationLevel()
                    + "|" + command.contextScopes());
            beginCommand(identity, idempotencyKey, requestHash);
            UUID id = UUID.randomUUID();
            jdbc.sql("""
                    insert into medical_agent_run(
                      tenant_id, run_id, context_lease_id, root_agent_code, root_agent_version,
                      composition_code, composition_version, requested_stage, patient_id, encounter_id,
                      target_type, target_id, objective, model_deployment_id, authorization_level,
                      context_scopes, state, created_by)
                    values (:tenant, :run, :lease, :root, :root_version, :composition, :composition_version,
                      :stage, :patient, :encounter, :target_type, :target_id, :objective, :model,
                      :authorization, cast(:scopes as jsonb), 'QUEUED', :actor)
                    """).param("tenant", identity.tenantId()).param("run", id)
                    .param("lease", command.contextLeaseId()).param("root", main.agentCode())
                    .param("root_version", main.agentVersion()).param("composition", main.compositionCode())
                    .param("composition_version", main.compositionVersion()).param("stage", command.stageCode())
                    .param("patient", command.patientId()).param("encounter", command.encounterId())
                    .param("target_type", command.targetType()).param("target_id", command.targetId())
                    .param("objective", command.objective().trim()).param("model", model.deploymentId())
                    .param("authorization", command.authorizationLevel()).param("scopes", json(command.contextScopes()))
                    .param("actor", identity.userId()).update();
            appendEvent(identity.tenantId(), id, null, "RunCreated", Map.of(
                    "root_agent_code", main.agentCode(), "stage_code", command.stageCode(),
                    "candidate_only", true, "model_deployment_id", model.deploymentId(),
                    "model_display_name", model.displayName(), "authorization_level", command.authorizationLevel(),
                    "context_scopes", command.contextScopes()));
            transition(identity.tenantId(), id, "RUNNING", "MainAgentStarted", Map.of(
                    "root_agent_code", main.agentCode(), "composition_code", main.compositionCode()));
            ContextFacts facts = contextFacts(identity.tenantId(), command.encounterId(), lease.watermark(),
                    Set.copyOf(command.contextScopes()));
            List<Map<String, Object>> contributions = new ArrayList<>();
            boolean partial = false;
            for (NodeRow node : nodes) {
                UUID childRunId = UUID.randomUUID();
                jdbc.sql("""
                        insert into medical_agent_child_run(
                          tenant_id, child_run_id, root_run_id, child_agent_code, child_agent_version,
                          state, critical, started_at)
                        values (:tenant, :child, :root, :code, :version, 'RUNNING', :critical, now())
                        """).param("tenant", identity.tenantId()).param("child", childRunId).param("root", id)
                        .param("code", node.agentCode()).param("version", node.agentVersion())
                        .param("critical", node.critical()).update();
                appendEvent(identity.tenantId(), id, childRunId, "ChildAgentStarted", Map.of(
                        "child_agent_code", node.agentCode(), "display_name", node.displayName(),
                        "current_action", node.currentAction()));
                Map<String, Object> contribution = contribution(node, command, facts);
                List<Map<String, Object>> sourceRefs = facts.sourceReferences();
                String childState = sourceRefs.isEmpty() ? "PARTIAL" : "COMPLETED";
                partial |= "PARTIAL".equals(childState);
                jdbc.sql("""
                        update medical_agent_child_run set state = :state,
                          contribution = cast(:contribution as jsonb), source_references = cast(:sources as jsonb),
                          completed_at = now()
                        where tenant_id = :tenant and child_run_id = :child
                        """).param("state", childState).param("contribution", json(contribution))
                        .param("sources", json(sourceRefs)).param("tenant", identity.tenantId())
                        .param("child", childRunId).update();
                appendEvent(identity.tenantId(), id, childRunId, "ChildContributionReady", Map.of(
                        "child_agent_code", node.agentCode(), "state", childState,
                        "source_reference_count", sourceRefs.size(), "contribution_label", node.contributionLabel()));
                appendEvent(identity.tenantId(), id, childRunId, "ChildHandoffReceived", Map.of(
                        "from", node.agentCode(), "to", main.agentCode(), "state", childState));
                contributions.add(contribution);
            }
            Map<String, Object> output = new LinkedHashMap<>();
            output.put("candidate_only", true);
            output.put("root_agent_code", main.agentCode());
            output.put("stage_code", command.stageCode());
            output.put("objective", command.objective().trim());
            output.put("summary", "Eva 已汇总 " + contributions.size() + " 位医助的处理结果，等待医生审阅。");
            output.put("model_deployment_id", model.deploymentId());
            output.put("model_display_name", model.displayName());
            output.put("authorization_level", command.authorizationLevel());
            output.put("context_scopes", command.contextScopes());
            output.put("context_counts", Map.of("documents", facts.documentCount(), "results", facts.resultCount(),
                    "orders", facts.orderCount(), "open_tasks", facts.openTaskCount(),
                    "attachments", facts.attachmentCount(), "open_critical_values", facts.openCriticalCount()));
            output.put("contributions", contributions);
            output.put("warnings", List.of("本结果为 AI 协作候选，不自动写入病历、诊断、医嘱、结果或任务终态。"));
            String finalState = partial ? "PARTIAL" : "WAITING_FOR_REVIEW";
            jdbc.sql("""
                    update medical_agent_run set state = :state, output_payload = cast(:output as jsonb),
                      sequence = sequence + 1, completed_at = now(), row_version = row_version + 1
                    where tenant_id = :tenant and run_id = :run
                    returning sequence
                    """).param("state", finalState).param("output", json(output))
                    .param("tenant", identity.tenantId()).param("run", id).query(Long.class).single();
            insertEventAtCurrentSequence(identity.tenantId(), id, "RunReadyForReview", Map.of(
                    "state", finalState, "child_count", contributions.size(), "candidate_only", true));
            long tokensConsumed = Math.min(budget.maxTokens(),
                    1_200L + contributions.size() * 900L + facts.documentCount() * 120L
                            + facts.resultCount() * 80L);
            int durationSeconds = (int) Math.min(budget.maxDurationSeconds(),
                    Math.max(1L, contributions.size() * 3L + facts.documentCount()));
            jdbc.sql("""
                    insert into agent_run_budget_consumption(
                      tenant_id, consumption_id, budget_id, run_id, tokens_consumed,
                      duration_seconds, recorded_by, recorded_at)
                    values (:tenant, :consumption, :budget, :run, :tokens, :duration, :actor, now())
                    on conflict (tenant_id, budget_id, run_id) do nothing
                    """).param("tenant", identity.tenantId()).param("consumption", UUID.randomUUID())
                    .param("budget", budget.budgetId()).param("run", id).param("tokens", tokensConsumed)
                    .param("duration", durationSeconds).param("actor", identity.userId()).update();
            appendEvent(identity.tenantId(), id, null, "BudgetConsumptionRecorded", Map.of(
                    "budget_code", budget.budgetCode(), "tokens_consumed", tokensConsumed,
                    "duration_seconds", durationSeconds));
            appendEvidence(identity, id, main.agentCode(), finalState);
            completeCommand(identity, idempotencyKey, id);
            return id;
        });
        return run(identity.tenantId(), runId);
    }

    RunView run(UUID tenantId, UUID runId) {
        RootRunRow root = jdbc.sql("""
                select run_id, context_lease_id, root_agent_code, root_agent_version, composition_code,
                  composition_version, requested_stage, patient_id, encounter_id, target_type, target_id,
                  objective, state, sequence, output_payload::text, created_at, completed_at, row_version
                from medical_agent_run where tenant_id = :tenant and run_id = :run
                """).param("tenant", tenantId).param("run", runId)
                .query((rs, row) -> new RootRunRow(
                        rs.getObject("run_id", UUID.class), rs.getObject("context_lease_id", UUID.class),
                        rs.getString("root_agent_code"), rs.getString("root_agent_version"),
                        rs.getString("composition_code"), rs.getString("composition_version"),
                        rs.getString("requested_stage"), rs.getObject("patient_id", UUID.class),
                        rs.getObject("encounter_id", UUID.class), rs.getString("target_type"),
                        rs.getObject("target_id", UUID.class), rs.getString("objective"), rs.getString("state"),
                        rs.getLong("sequence"), rs.getString("output_payload"),
                        rs.getObject("created_at", OffsetDateTime.class),
                        rs.getObject("completed_at", OffsetDateTime.class), rs.getLong("row_version")))
                .optional().orElseThrow(MedicalAgentHarnessService::contextDenied);
        List<ChildRunView> children = jdbc.sql("""
                select child.child_run_id, child.child_agent_code, release.display_name, release.display_role,
                  release.current_action, release.contribution_label, child.state, child.critical,
                  child.contribution::text, child.source_references::text, child.started_at, child.completed_at
                from medical_agent_child_run child
                join medical_agent_release release on release.agent_code = child.child_agent_code
                  and release.release_version = child.child_agent_version
                where child.tenant_id = :tenant and child.root_run_id = :run
                order by child.started_at, child.child_run_id
                """).param("tenant", tenantId).param("run", runId)
                .query((rs, row) -> new ChildRunView(
                        rs.getObject("child_run_id", UUID.class), rs.getString("child_agent_code"),
                        rs.getString("display_name"), rs.getString("display_role"), rs.getString("current_action"),
                        rs.getString("contribution_label"), rs.getString("state"), rs.getBoolean("critical"),
                        map(rs.getString("contribution")), listOfMaps(rs.getString("source_references")),
                        rs.getObject("started_at", OffsetDateTime.class),
                        rs.getObject("completed_at", OffsetDateTime.class))).list();
        List<RunEventView> events = jdbc.sql("""
                select sequence, event_type, child_run_id, payload::text, occurred_at
                from medical_agent_run_event where tenant_id = :tenant and run_id = :run order by sequence
                """).param("tenant", tenantId).param("run", runId)
                .query((rs, row) -> new RunEventView(rs.getLong("sequence"), rs.getString("event_type"),
                        rs.getObject("child_run_id", UUID.class), map(rs.getString("payload")),
                        rs.getObject("occurred_at", OffsetDateTime.class))).list();
        return new RunView(root.runId(), root.contextLeaseId(), root.rootAgentCode(), root.rootAgentVersion(),
                root.compositionCode(), root.compositionVersion(), root.stageCode(), root.patientId(),
                root.encounterId(), root.targetType(), root.targetId(), root.objective(), root.state(), root.sequence(),
                map(root.output()), root.createdAt(), root.completedAt(), root.rowVersion(), children, events);
    }

    List<RunView> listRuns(UUID tenantId, UUID encounterId) {
        List<UUID> ids = jdbc.sql("""
                select run_id from medical_agent_run
                where tenant_id = :tenant and encounter_id = :encounter
                order by created_at desc, run_id desc limit 100
                """).param("tenant", tenantId).param("encounter", encounterId).query(UUID.class).list();
        return ids.stream().map(id -> run(tenantId, id)).toList();
    }

    private ModelSelection resolveModel(UUID tenantId, UUID requestedDeploymentId) {
        String requested = requestedDeploymentId == null ? "" : " and model_deployment_id = :deployment";
        JdbcClient.StatementSpec query = jdbc.sql("""
                select model_deployment_id, display_name from model_deployment
                where tenant_id = :tenant and status = 'ACTIVE' and evaluation_status = 'APPROVED'
                  and connection_status = 'READY'
                """ + requested + " order by updated_at desc, model_deployment_id limit 1")
                .param("tenant", tenantId);
        if (requestedDeploymentId != null) query = query.param("deployment", requestedDeploymentId);
        return query.query((rs, row) -> new ModelSelection(
                        rs.getObject("model_deployment_id", UUID.class), rs.getString("display_name")))
                .optional().orElseThrow(() -> new AgentRunException(
                        "MEDICAL_AGENT_MODEL_UNAVAILABLE", 409,
                        requestedDeploymentId == null
                                ? "No approved and connected model service is available"
                                : "The selected model service is not approved, connected or active"));
    }

    private ActiveBudget ensureGovernanceReady(UUID tenantId, String mainAgentCode) {
        UUID registryId = jdbc.sql("""
                select agent_registry_id from agent_registry
                where tenant_id = :tenant and agent_code = :code and status = 'ACTIVE'
                order by updated_at desc limit 1
                """).param("tenant", tenantId).param("code", mainAgentCode)
                .query(UUID.class).optional().orElseThrow(() -> new AgentRunException(
                        "MEDICAL_AGENT_DISABLED", 409, "The selected medical assistant team is not active"));
        List<DependencyRow> dependencies = jdbc.sql("""
                select dependency_type, dependency_code from agent_dependency
                where tenant_id = :tenant and agent_registry_id = :registry
                order by dependency_type, dependency_code
                """).param("tenant", tenantId).param("registry", registryId)
                .query((rs, row) -> new DependencyRow(
                        rs.getString("dependency_type"), rs.getString("dependency_code"))).list();
        for (DependencyRow dependency : dependencies) {
            String table = "SKILL".equals(dependency.type()) ? "skill_registry" : "tool_registry";
            String codeColumn = "SKILL".equals(dependency.type()) ? "skill_code" : "tool_code";
            long active = jdbc.sql("select count(*) from " + table
                            + " where tenant_id = :tenant and " + codeColumn + " = :code and status = 'ACTIVE'")
                    .param("tenant", tenantId).param("code", dependency.code()).query(Long.class).single();
            if (active == 0) {
                throw new AgentRunException("MEDICAL_AGENT_DEPENDENCY_DISABLED", 409,
                        "A required medical assistant capability or tool is inactive: " + dependency.code());
            }
        }
        long passedEvaluation = jdbc.sql("""
                select count(*) from config_item
                where tenant_id = :tenant and config_type = 'AGENT_EVAL' and status = 'ACTIVE'
                  and payload ->> 'target_agent' = :agent
                  and coalesce((payload ->> 'measured_score')::numeric, 0)
                      >= coalesce((payload ->> 'pass_threshold')::numeric, 1)
                  and payload ->> 'release_gate' = 'PASSED'
                """).param("tenant", tenantId).param("agent", mainAgentCode).query(Long.class).single();
        if (passedEvaluation == 0) {
            throw new AgentRunException("MEDICAL_AGENT_EVALUATION_BLOCKED", 409,
                    "The selected medical assistant team has no active passed release evaluation");
        }
        String budgetCode = switch (mainAgentCode) {
            case "RESULT_FOLLOWUP_COORDINATOR" -> "BUDGET_RESULT_FOLLOWUP";
            default -> "BUDGET_" + mainAgentCode;
        };
        return jdbc.sql("""
                select budget_id, budget_code, max_tokens, max_duration_seconds from agent_run_budget
                where tenant_id = :tenant and budget_code = :budget and status = 'ACTIVE'
                order by updated_at desc limit 1
                """).param("tenant", tenantId).param("budget", budgetCode)
                .query((rs, row) -> new ActiveBudget(
                        rs.getObject("budget_id", UUID.class), rs.getString("budget_code"),
                        rs.getLong("max_tokens"), rs.getInt("max_duration_seconds")))
                .optional().orElseThrow(() -> new AgentRunException(
                        "MEDICAL_AGENT_BUDGET_DISABLED", 409,
                        "The selected medical assistant team has no active processing quota"));
    }

    RunContext context(UUID tenantId, UUID runId) {
        return jdbc.sql("""
                select lease.organization_id, lease.facility_id, run.patient_id, run.encounter_id
                from medical_agent_run run join context_lease lease
                  on lease.tenant_id = run.tenant_id and lease.lease_id = run.context_lease_id
                where run.tenant_id = :tenant and run.run_id = :run
                """).param("tenant", tenantId).param("run", runId)
                .query((rs, row) -> new RunContext(rs.getObject("organization_id", UUID.class),
                        rs.getObject("facility_id", UUID.class), rs.getObject("patient_id", UUID.class),
                        rs.getObject("encounter_id", UUID.class)))
                .optional().orElseThrow(MedicalAgentHarnessService::contextDenied);
    }

    private LeaseRow lease(ClinicalIdentity identity, CreateRunCommand command) {
        return jdbc.sql("""
                select authorization_watermark from context_lease
                where tenant_id = :tenant and lease_id = :lease and organization_id = :organization
                  and facility_id = :facility and user_id = :user and patient_id = :patient
                  and encounter_id = :encounter and revoked_at is null and expires_at > now()
                """).param("tenant", identity.tenantId()).param("lease", command.contextLeaseId())
                .param("organization", command.organizationId()).param("facility", command.facilityId())
                .param("user", identity.userId()).param("patient", command.patientId())
                .param("encounter", command.encounterId())
                .query((rs, row) -> new LeaseRow(rs.getString("authorization_watermark")))
                .optional().orElseThrow(() -> new AgentRunException(
                        "CONTEXT_NOT_PERMITTED", 403, "The medical-agent context lease is invalid or expired"));
    }

    private void validateTarget(UUID tenantId, CreateRunCommand command) {
        boolean matchesContext = switch (command.targetType()) {
            case "ENCOUNTER" -> command.targetId().equals(command.encounterId());
            case "DOCUMENT" -> targetExists("clinical_document", "document_id", tenantId, command);
            case "RESULT" -> targetExists("clinical_result", "result_id", tenantId, command);
            case "TASK" -> targetExists("clinical_task", "task_id", tenantId, command);
            case "CARE_PLAN" -> targetExists("nursing_care_plan", "care_plan_id", tenantId, command);
            default -> false;
        };
        if (!matchesContext) {
            throw new AgentRunException("TARGET_CONTEXT_MISMATCH", 403,
                    "The selected target does not belong to the leased patient and encounter context");
        }
    }

    private boolean targetExists(String table, String idColumn, UUID tenantId, CreateRunCommand command) {
        return jdbc.sql("select count(*) from " + table
                        + " where tenant_id = :tenant and " + idColumn + " = :target"
                        + " and patient_id = :patient and encounter_id = :encounter")
                .param("tenant", tenantId).param("target", command.targetId())
                .param("patient", command.patientId()).param("encounter", command.encounterId())
                .query(Long.class).single() == 1;
    }

    private MainReleaseRow main(String agentCode) {
        return jdbc.sql("""
                select release.agent_code, release.release_version, composition.composition_code,
                  composition.release_version as composition_version
                from medical_agent_release release
                join medical_agent_composition_release composition
                  on composition.root_agent_code = release.agent_code
                  and composition.release_version = release.release_version
                where release.agent_code = :code and release.agent_level = 'MAIN'
                  and release.status = 'ACTIVE' and composition.status = 'ACTIVE'
                """).param("code", agentCode)
                .query((rs, row) -> new MainReleaseRow(rs.getString("agent_code"),
                        rs.getString("release_version"), rs.getString("composition_code"),
                        rs.getString("composition_version")))
                .optional().orElseThrow(() -> new AgentRunException(
                        "AGENT_RELEASE_NOT_ACTIVE", 409, "The selected main-agent release is not active"));
    }

    private List<NodeRow> nodes(String compositionCode, String stageCode) {
        String stagePredicate = "ALL".equals(stageCode) ? "" : " and node.stage_code = :stage";
        JdbcClient.StatementSpec query = jdbc.sql("""
                select node.child_agent_code, release.release_version, release.display_name,
                  release.display_role, release.current_action, release.contribution_label,
                  release.output_schema, node.critical
                from medical_agent_composition_node node
                join medical_agent_release release on release.agent_code = node.child_agent_code
                  and release.release_version = node.release_version and release.status = 'ACTIVE'
                where node.composition_code = :composition
                """ + stagePredicate + " order by node.node_order").param("composition", compositionCode);
        if (!"ALL".equals(stageCode)) query = query.param("stage", stageCode);
        return query.query((rs, row) -> new NodeRow(rs.getString("child_agent_code"),
                rs.getString("release_version"), rs.getString("display_name"), rs.getString("display_role"),
                rs.getString("current_action"), rs.getString("contribution_label"),
                rs.getString("output_schema"), rs.getBoolean("critical"))).list();
    }

    private ContextFacts contextFacts(UUID tenantId, UUID encounterId, String watermark, Set<String> scopes) {
        List<Map<String, Object>> references = new ArrayList<>();
        if (scopes.contains("RECORDS")) references.addAll(jdbc.sql("""
                select document.document_id, document.current_version_id, document.document_type_code,
                  document.status, version.content_hash
                from clinical_document document
                join clinical_document_version version on version.tenant_id = document.tenant_id
                  and version.document_id = document.document_id
                  and version.document_version_id = document.current_version_id
                where document.tenant_id = :tenant and document.encounter_id = :encounter
                order by document.updated_at desc, document.document_id limit 20
                """).param("tenant", tenantId).param("encounter", encounterId)
                .query((rs, row) -> Map.<String, Object>of(
                        "source_type", "DOCUMENT_VERSION", "source_id", rs.getObject("current_version_id", UUID.class),
                        "document_id", rs.getObject("document_id", UUID.class),
                        "document_type", rs.getString("document_type_code"), "status", rs.getString("status"),
                        "content_hash", rs.getString("content_hash"), "authorization_watermark", watermark)).list());
        if (scopes.contains("RESULTS")) references.addAll(jdbc.sql("""
                select result_id, current_version_id, report_type
                from clinical_result where tenant_id = :tenant and encounter_id = :encounter
                order by updated_at desc, result_id limit 20
                """).param("tenant", tenantId).param("encounter", encounterId)
                .query((rs, row) -> Map.<String, Object>of(
                        "source_type", "RESULT_VERSION", "source_id", rs.getObject("current_version_id", UUID.class),
                        "result_id", rs.getObject("result_id", UUID.class), "report_type", rs.getString("report_type"),
                        "authorization_watermark", watermark)).list());
        long documents = scopes.contains("RECORDS") ? count(
                "select count(*) from clinical_document where tenant_id = :tenant and encounter_id = :encounter",
                tenantId, encounterId) : 0;
        long orders = scopes.contains("ORDERS") ? count(
                "select count(*) from clinical_order where tenant_id = :tenant and encounter_id = :encounter",
                tenantId, encounterId) : 0;
        long results = scopes.contains("RESULTS") ? count(
                "select count(*) from clinical_result where tenant_id = :tenant and encounter_id = :encounter",
                tenantId, encounterId) : 0;
        long tasks = scopes.contains("TASKS") ? count("""
                select count(*) from clinical_task where tenant_id = :tenant and encounter_id = :encounter
                  and state not in ('COMPLETED', 'WITHDRAWN', 'EXPIRED')
                """, tenantId, encounterId) : 0;
        long attachments = scopes.contains("ATTACHMENTS") ? count("""
                select count(*) from clinical_document_attachment
                where tenant_id = :tenant and encounter_id = :encounter
                  and storage_status = 'AVAILABLE' and malware_scan_status = 'PASSED'
                """, tenantId, encounterId) : 0;
        long critical = scopes.contains("RESULTS") ? count("""
                select count(*) from critical_value_case where tenant_id = :tenant and encounter_id = :encounter
                  and state <> 'DISPOSED'
                """, tenantId, encounterId) : 0;
        return new ContextFacts(documents, orders, results, tasks, attachments, critical, List.copyOf(references));
    }

    private long count(String sql, UUID tenantId, UUID encounterId) {
        return jdbc.sql(sql).param("tenant", tenantId).param("encounter", encounterId).query(Long.class).single();
    }

    private Map<String, Object> contribution(NodeRow node, CreateRunCommand command, ContextFacts facts) {
        Map<String, Object> contribution = new LinkedHashMap<>();
        contribution.put("agent_code", node.agentCode());
        contribution.put("display_name", node.displayName());
        contribution.put("role", node.displayRole());
        contribution.put("action", node.currentAction());
        contribution.put("contribution_label", node.contributionLabel());
        contribution.put("output_schema", node.outputSchema());
        contribution.put("summary", node.displayName() + "已完成当前诊疗范围核对，并将可定位事实交回 Eva 汇总。");
        contribution.put("facts", List.of(
                "当前就诊可定位文书 " + facts.documentCount() + " 份",
                "已授权医嘱记录 " + facts.orderCount() + " 项",
                "已确认结果记录 " + facts.resultCount() + " 项",
                "未闭环任务 " + facts.openTaskCount() + " 项",
                "已通过安全检查的附件 " + facts.attachmentCount() + " 份",
                "未处置危急值 " + facts.openCriticalCount() + " 项"));
        contribution.put("gaps", facts.sourceReferences().isEmpty()
                ? List.of("当前作用域没有可定位文书版本，贡献降级为 PARTIAL。") : List.of());
        contribution.put("warnings", List.of("不把计划当执行，不把未报告结果解释为阴性，不生成正式临床终态。"));
        contribution.put("source_references", facts.sourceReferences());
        contribution.put("objective", command.objective().trim());
        contribution.put("objective_trust", "UNTRUSTED_USER_INPUT");
        return contribution;
    }

    private void transition(UUID tenantId, UUID runId, String state, String eventType, Map<String, Object> payload) {
        long sequence = jdbc.sql("""
                update medical_agent_run set state = :state, sequence = sequence + 1,
                  row_version = row_version + 1
                where tenant_id = :tenant and run_id = :run returning sequence
                """).param("state", state).param("tenant", tenantId).param("run", runId)
                .query(Long.class).single();
        insertEvent(tenantId, runId, sequence, null, eventType, payload);
    }

    private void appendEvent(UUID tenantId, UUID runId, UUID childRunId, String eventType, Map<String, Object> payload) {
        long sequence = jdbc.sql("""
                update medical_agent_run set sequence = sequence + 1, row_version = row_version + 1
                where tenant_id = :tenant and run_id = :run returning sequence
                """).param("tenant", tenantId).param("run", runId).query(Long.class).single();
        insertEvent(tenantId, runId, sequence, childRunId, eventType, payload);
    }

    private void insertEventAtCurrentSequence(UUID tenantId, UUID runId, String eventType, Map<String, Object> payload) {
        long sequence = jdbc.sql("select sequence from medical_agent_run where tenant_id = :tenant and run_id = :run")
                .param("tenant", tenantId).param("run", runId).query(Long.class).single();
        insertEvent(tenantId, runId, sequence, null, eventType, payload);
    }

    private void insertEvent(UUID tenantId, UUID runId, long sequence, UUID childRunId,
            String eventType, Map<String, Object> payload) {
        jdbc.sql("""
                insert into medical_agent_run_event(
                  tenant_id, run_id, sequence, event_id, event_type, child_run_id, payload)
                values (:tenant, :run, :sequence, :event, :type, :child, cast(:payload as jsonb))
                """).param("tenant", tenantId).param("run", runId).param("sequence", sequence)
                .param("event", UUID.randomUUID()).param("type", eventType).param("child", childRunId)
                .param("payload", json(payload)).update();
    }

    private void beginCommand(ClinicalIdentity identity, String key, String requestHash) {
        if (key == null || key.isBlank() || key.length() > 128) {
            throw new AgentRunException("INVALID_IDEMPOTENCY_KEY", 400, "A valid Idempotency-Key is required");
        }
        int inserted = jdbc.sql("""
                insert into idempotency_record(
                  tenant_id, command_scope, idempotency_key, request_hash, state, trace_id, expires_at)
                values (:tenant, 'MEDICAL_AGENT_RUN_CREATE', :key, :hash, 'IN_PROGRESS', :trace,
                  now() + interval '24 hours')
                on conflict (tenant_id, command_scope, idempotency_key) do nothing
                """).param("tenant", identity.tenantId()).param("key", key).param("hash", requestHash)
                .param("trace", UUID.randomUUID().toString()).update();
        if (inserted != 1) {
            throw new AgentRunException("IDEMPOTENCY_REPLAY", 409, "This medical-agent command key was already used");
        }
    }

    private void completeCommand(ClinicalIdentity identity, String key, UUID runId) {
        jdbc.sql("""
                update idempotency_record set state = 'SUCCEEDED', response_status = 202,
                  response_ref = jsonb_build_object('resource_id', :resource)
                where tenant_id = :tenant and command_scope = 'MEDICAL_AGENT_RUN_CREATE'
                  and idempotency_key = :key
                """).param("resource", runId).param("tenant", identity.tenantId()).param("key", key).update();
    }

    private void appendEvidence(ClinicalIdentity identity, UUID runId, String rootAgentCode, String state) {
        jdbc.sql("select tenant_id from tenant where tenant_id = :tenant for update")
                .param("tenant", identity.tenantId()).query(UUID.class).single();
        String previousHash = jdbc.sql("""
                select event_hash from audit_event where tenant_id = :tenant
                order by occurred_at desc, audit_event_id desc limit 1
                """).param("tenant", identity.tenantId()).query(String.class).optional().orElse(null);
        UUID auditId = UUID.randomUUID();
        String trace = UUID.randomUUID().toString();
        String eventHash = sha256(identity.tenantId() + "|" + auditId + "|MEDICAL_AGENT_RUN_READY|"
                + runId + "|" + trace + "|" + (previousHash == null ? "GENESIS" : previousHash));
        jdbc.sql("""
                insert into audit_event(
                  tenant_id, audit_event_id, occurred_at, actor_user_id, action_code,
                  resource_type, resource_id, trace_id, previous_hash, event_hash)
                values (:tenant, :audit, now(), :actor, 'MEDICAL_AGENT_RUN_READY',
                  'MEDICAL_AGENT_RUN', :resource, :trace, :previous, :event_hash)
                """).param("tenant", identity.tenantId()).param("audit", auditId)
                .param("actor", identity.userId()).param("resource", runId).param("trace", trace)
                .param("previous", previousHash).param("event_hash", eventHash).update();
        jdbc.sql("""
                insert into outbox_event(
                  tenant_id, event_id, aggregate_type, aggregate_id, aggregate_version,
                  event_type, schema_version, payload)
                values (:tenant, :event, 'MEDICAL_AGENT_RUN', :run, 1,
                  'MedicalAgentRunReadyForReview', 1,
                  jsonb_build_object('root_agent_code', :root, 'state', :state))
                """).param("tenant", identity.tenantId()).param("event", UUID.randomUUID())
                .param("run", runId).param("root", rootAgentCode).param("state", state).update();
    }

    private void validate(CreateRunCommand command) {
        if (command.contextLeaseId() == null || command.organizationId() == null || command.facilityId() == null
                || command.patientId() == null || command.encounterId() == null || command.targetId() == null) {
            throw invalid("organization, facility, patient, encounter, context lease and target are required");
        }
        if (command.mainAgentCode() == null || command.mainAgentCode().isBlank()
                || command.stageCode() == null || command.stageCode().isBlank()) {
            throw invalid("main_agent_code and stage_code are required");
        }
        if (command.targetType() == null || !TARGET_TYPES.contains(command.targetType())) {
            throw invalid("target_type must be ENCOUNTER, DOCUMENT, RESULT, TASK or CARE_PLAN");
        }
        if (command.objective() == null || command.objective().trim().length() < 2
                || command.objective().trim().length() > 1024) {
            throw invalid("objective must contain 2 to 1024 characters");
        }
        if (command.authorizationLevel() == null
                || !AUTHORIZATION_LEVELS.contains(command.authorizationLevel())) {
            throw invalid("authorization_level must be READ_ONLY, STANDARD or EXTENDED");
        }
        if (command.contextScopes() == null || command.contextScopes().isEmpty()
                || command.contextScopes().size() > CONTEXT_SCOPES.size()
                || !CONTEXT_SCOPES.containsAll(command.contextScopes())) {
            throw invalid("context_scopes must contain one or more supported clinical data scopes");
        }
    }

    private AgentReleaseView view(AgentReleaseRow row) {
        return new AgentReleaseView(row.code(), row.version(), row.displayName(), row.level(), row.parentCode(),
                row.stageCode(), row.description(), row.displayRole(), row.currentAction(), row.contributionLabel(),
                row.questionExamples(), row.outputSchema(), row.autonomyLevel(), row.maxSteps(), row.maxToolCalls(),
                row.maxDurationSeconds());
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> map(String json) {
        try {
            return objectMapper.convertValue(objectMapper.readTree(json), Map.class);
        } catch (Exception invalid) {
            throw new IllegalStateException("Stored medical-agent JSON is invalid", invalid);
        }
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> listOfMaps(String json) {
        try {
            return objectMapper.convertValue(objectMapper.readTree(json), List.class);
        } catch (Exception invalid) {
            throw new IllegalStateException("Stored medical-agent JSON list is invalid", invalid);
        }
    }

    @SuppressWarnings("unchecked")
    private List<String> listOfStrings(String json) {
        try {
            return objectMapper.convertValue(objectMapper.readTree(json), List.class);
        } catch (Exception invalid) {
            throw new IllegalStateException("Stored medical-agent question examples are invalid", invalid);
        }
    }

    private String json(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception invalid) {
            throw new IllegalStateException("Medical-agent value cannot be serialized", invalid);
        }
    }

    private static AgentRunException invalid(String message) {
        return new AgentRunException("MEDICAL_AGENT_REQUEST_INVALID", 400, message);
    }

    private static AgentRunException contextDenied() {
        return new AgentRunException("CONTEXT_NOT_PERMITTED", 403,
                "The requested medical-agent context is not permitted");
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    record CreateRunCommand(UUID organizationId, UUID facilityId, UUID patientId, UUID encounterId,
            UUID contextLeaseId, String mainAgentCode, String stageCode, String targetType,
            UUID targetId, String objective, UUID modelDeploymentId, String authorizationLevel,
            List<String> contextScopes) {}

    record AgentFamilyView(AgentReleaseView mainAgent, List<AgentReleaseView> childAgents) {}

    record AgentReleaseView(String agentCode, String releaseVersion, String displayName, String agentLevel,
            String parentAgentCode, String stageCode, String description, String displayRole,
            String currentAction, String contributionLabel, List<String> questionExamples,
            String outputSchema, String autonomyLevel,
            int maxSteps, int maxToolCalls, int maxDurationSeconds) {}

    record RunView(UUID runId, UUID contextLeaseId, String rootAgentCode, String rootAgentVersion,
            String compositionCode, String compositionVersion, String requestedStage, UUID patientId,
            UUID encounterId, String targetType, UUID targetId, String objective, String state, long sequence,
            Map<String, Object> output, OffsetDateTime createdAt, OffsetDateTime completedAt, long rowVersion,
            List<ChildRunView> childRuns, List<RunEventView> events) {}

    record ChildRunView(UUID childRunId, String childAgentCode, String displayName, String displayRole,
            String currentAction, String contributionLabel, String state, boolean critical,
            Map<String, Object> contribution, List<Map<String, Object>> sourceReferences,
            OffsetDateTime startedAt, OffsetDateTime completedAt) {}

    record RunEventView(long sequence, String eventType, UUID childRunId, Map<String, Object> payload,
            OffsetDateTime occurredAt) {}

    record RunContext(UUID organizationId, UUID facilityId, UUID patientId, UUID encounterId) {}
    private record DependencyRow(String type, String code) {}
    private record ActiveBudget(UUID budgetId, String budgetCode, long maxTokens, int maxDurationSeconds) {}

    private record AgentReleaseRow(String code, String version, String displayName, String level,
            String parentCode, String stageCode, String description, String displayRole, String currentAction,
            String contributionLabel, String outputSchema, String autonomyLevel, int maxSteps,
            int maxToolCalls, int maxDurationSeconds, List<String> questionExamples) {}
    private record MainReleaseRow(String agentCode, String agentVersion, String compositionCode,
            String compositionVersion) {}
    private record NodeRow(String agentCode, String agentVersion, String displayName, String displayRole,
            String currentAction, String contributionLabel, String outputSchema, boolean critical) {}
    private record LeaseRow(String watermark) {}
    private record ContextFacts(long documentCount, long orderCount, long resultCount, long openTaskCount,
            long attachmentCount, long openCriticalCount, List<Map<String, Object>> sourceReferences) {}
    private record ModelSelection(UUID deploymentId, String displayName) {}
    private record RootRunRow(UUID runId, UUID contextLeaseId, String rootAgentCode, String rootAgentVersion,
            String compositionCode, String compositionVersion, String stageCode, UUID patientId, UUID encounterId,
            String targetType, UUID targetId, String objective, String state, long sequence, String output,
            OffsetDateTime createdAt, OffsetDateTime completedAt, long rowVersion) {}
}
