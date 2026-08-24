package org.openemr2026.tasks;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import org.openemr2026.contracts.ClinicalTaskCommandRequestWire;
import org.openemr2026.contracts.ClinicalTaskCollaborationRequestWire;
import org.openemr2026.contracts.ClinicalTaskExpirationResultWire;
import org.openemr2026.contracts.ClinicalTaskWire;
import org.openemr2026.security.ClinicalIdentity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
final class ClinicalTaskService {
    private final JdbcClient jdbc;
    private final TransactionTemplate transactions;

    ClinicalTaskService(JdbcClient jdbc, TransactionTemplate transactions) {
        this.jdbc = jdbc;
        this.transactions = transactions;
    }

    List<ClinicalTaskWire> list(
            ClinicalIdentity identity, UUID patientId, UUID encounterId, UUID facilityId) {
        requireEncounter(identity.tenantId(), patientId, encounterId, facilityId);
        return jdbc.sql("""
                select task_id from clinical_task
                where tenant_id = :tenant and patient_id = :patient
                  and encounter_id = :encounter and facility_id = :facility
                order by case risk_level when 'CRITICAL' then 1 when 'HIGH' then 2 else 3 end,
                  due_at nulls last, created_at, task_id
                """).param("tenant", identity.tenantId()).param("patient", patientId)
                .param("encounter", encounterId).param("facility", facilityId)
                .query(UUID.class).list().stream()
                .map(taskId -> snapshot(identity.tenantId(), taskId, patientId, encounterId, facilityId))
                .toList();
    }

    ClinicalTaskWire view(
            ClinicalIdentity identity, String idempotencyKey, UUID taskId,
            ClinicalTaskCommandRequestWire command) {
        return transition(identity, idempotencyKey, taskId, command, Action.VIEW);
    }

    ClinicalTaskWire claim(
            ClinicalIdentity identity, String idempotencyKey, UUID taskId,
            ClinicalTaskCommandRequestWire command) {
        return transition(identity, idempotencyKey, taskId, command, Action.CLAIM);
    }

    ClinicalTaskWire delegate(
            ClinicalIdentity identity, String idempotencyKey, UUID taskId,
            ClinicalTaskCollaborationRequestWire command) {
        return collaborate(identity, idempotencyKey, taskId, command, Collaboration.DELEGATE);
    }

    ClinicalTaskWire transfer(
            ClinicalIdentity identity, String idempotencyKey, UUID taskId,
            ClinicalTaskCollaborationRequestWire command) {
        return collaborate(identity, idempotencyKey, taskId, command, Collaboration.TRANSFER);
    }

    ClinicalTaskWire escalate(
            ClinicalIdentity identity, String idempotencyKey, UUID taskId,
            ClinicalTaskCollaborationRequestWire command) {
        return collaborate(identity, idempotencyKey, taskId, command, Collaboration.ESCALATE);
    }

    ClinicalTaskExpirationResultWire expireOverdueTasks(
            ClinicalIdentity identity, UUID patientId, UUID encounterId, UUID facilityId) {
        requireEncounter(identity.tenantId(), patientId, encounterId, facilityId);
        return transactions.execute(status -> {
            List<OverdueTask> overdue = jdbc.sql("""
                    select task_id, patient_id, source_id, state, row_version
                    from clinical_task
                    where tenant_id = :tenant and patient_id = :patient
                      and encounter_id = :encounter and facility_id = :facility
                      and due_at is not null and due_at < now()
                      and state not in ('COMPLETED', 'WITHDRAWN', 'EXPIRED')
                    order by due_at, task_id
                    for update
                    """).param("tenant", identity.tenantId()).param("patient", patientId)
                    .param("encounter", encounterId).param("facility", facilityId)
                    .query((rs, row) -> new OverdueTask(
                            rs.getObject("task_id", UUID.class), rs.getObject("patient_id", UUID.class),
                            rs.getObject("source_id", UUID.class), rs.getString("state"),
                            rs.getLong("row_version"))).list();
            for (OverdueTask task : overdue) {
                int updated = jdbc.sql("""
                        update clinical_task set state = 'EXPIRED', row_version = row_version + 1, updated_at = now()
                        where tenant_id = :tenant and task_id = :task_id and row_version = :expected
                        """).param("tenant", identity.tenantId()).param("task_id", task.taskId())
                        .param("expected", task.rowVersion()).update();
                if (updated != 1) {
                    throw new ClinicalTaskException(
                            "CLINICAL_TASK_VERSION_CONFLICT", 409, "An overdue task changed during expiry");
                }
                jdbc.sql("""
                        insert into clinical_task_event(
                          tenant_id, task_event_id, task_id, event_type, previous_state, resulting_state,
                          actor_user_id, reason)
                        values (:tenant, gen_random_uuid(), :task_id, 'EXPIRED', :previous, 'EXPIRED',
                          :actor, 'TASK_DEADLINE_EXCEEDED')
                        """).param("tenant", identity.tenantId()).param("task_id", task.taskId())
                        .param("previous", task.state()).param("actor", identity.userId()).update();
                appendEvidence(identity, task.patientId(), task.taskId(), task.sourceId(),
                        task.rowVersion() + 1, "EXPIRED", null, "TASK_DEADLINE_EXCEEDED");
            }
            return new ClinicalTaskExpirationResultWire(
                    overdue.size(), encounterId, OffsetDateTime.now(ZoneOffset.UTC).toInstant());
        });
    }

    private ClinicalTaskWire transition(
            ClinicalIdentity identity, String idempotencyKey, UUID taskId,
            ClinicalTaskCommandRequestWire command, Action action) {
        if (command.expectedRowVersion() == null || command.expectedRowVersion() <= 0) {
            throw new ClinicalTaskException(
                    "CLINICAL_TASK_COMMAND_INVALID", 400, "A positive expected task version is required");
        }
        return transactions.execute(status -> {
            LockedTask task = lockTask(
                    identity.tenantId(), taskId, command.patientId(), command.encounterId(), command.facilityId());
            if (task.rowVersion() != command.expectedRowVersion()) {
                throw new ClinicalTaskException(
                        "CLINICAL_TASK_VERSION_CONFLICT", 409, "The task changed; reload before continuing");
            }
            List<String> allowed = action == Action.VIEW
                    ? List.of("PENDING", "ASSIGNED", "DELIVERED")
                    : List.of("PENDING", "ASSIGNED", "DELIVERED", "VIEWED", "ESCALATED");
            if (!allowed.contains(task.state())) {
                throw new ClinicalTaskException(
                        "CLINICAL_TASK_STATE_INVALID", 409, "The task state does not allow this collaboration action");
            }
            if (task.assignedUserId() != null
                    && !task.assignedUserId().equals(identity.userId())) {
                throw new ClinicalTaskException(
                        "CLINICAL_TASK_ASSIGNEE_REQUIRED", 403,
                        "Only the assigned user can claim this task version");
            }
            String scope = action == Action.VIEW ? "CLINICAL_TASK_VIEW" : "CLINICAL_TASK_CLAIM";
            String requestHash = sha256(taskId + "|" + command.expectedRowVersion() + "|" + action);
            beginCommand(identity, scope, idempotencyKey, requestHash);
            String nextState = action == Action.VIEW ? "VIEWED" : "CLAIMED";
            long nextVersion = jdbc.sql("""
                    update clinical_task set state = :state,
                      claimed_by = case when :state = 'CLAIMED' then :actor else claimed_by end,
                      row_version = row_version + 1, updated_at = now()
                    where tenant_id = :tenant and task_id = :task_id and row_version = :expected
                    returning row_version
                    """).param("state", nextState).param("actor", identity.userId())
                    .param("tenant", identity.tenantId()).param("task_id", taskId)
                    .param("expected", command.expectedRowVersion()).query(Long.class)
                    .optional().orElseThrow(() -> new ClinicalTaskException(
                            "CLINICAL_TASK_VERSION_CONFLICT", 409, "The task changed; reload before continuing"));
            String eventType = action == Action.VIEW ? "VIEWED" : "CLAIMED";
            jdbc.sql("""
                    insert into clinical_task_event(
                      tenant_id, task_event_id, task_id, event_type,
                      previous_state, resulting_state, actor_user_id)
                    values (:tenant, gen_random_uuid(), :task_id, :event_type,
                      :previous, :resulting, :actor)
                    """).param("tenant", identity.tenantId()).param("task_id", taskId)
                    .param("event_type", eventType).param("previous", task.state())
                    .param("resulting", nextState).param("actor", identity.userId()).update();
            appendEvidence(identity, command.patientId(), taskId, task.sourceId(), nextVersion, eventType, null, null);
            completeCommand(identity, scope, idempotencyKey, taskId);
            return snapshot(identity.tenantId(), taskId, command.patientId(), command.encounterId(), command.facilityId());
        });
    }

    private ClinicalTaskWire collaborate(
            ClinicalIdentity identity, String idempotencyKey, UUID taskId,
            ClinicalTaskCollaborationRequestWire command, Collaboration action) {
        validateCollaboration(identity, command, action);
        return transactions.execute(status -> {
            LockedTask task = lockTask(
                    identity.tenantId(), taskId, command.patientId(), command.encounterId(), command.facilityId());
            if (task.rowVersion() != command.expectedRowVersion()) {
                throw new ClinicalTaskException(
                        "CLINICAL_TASK_VERSION_CONFLICT", 409, "The task changed; reload before continuing");
            }
            if (!identity.userId().equals(task.claimedBy())) {
                throw new ClinicalTaskException(
                        "CLINICAL_TASK_OWNER_REQUIRED", 403,
                        "Only the current task owner can change responsibility");
            }
            List<String> allowed = action == Collaboration.ESCALATE
                    ? List.of("CLAIMED", "IN_PROGRESS") : List.of("CLAIMED");
            if (!allowed.contains(task.state())) {
                throw new ClinicalTaskException(
                        "CLINICAL_TASK_STATE_INVALID", 409,
                        "The task state does not allow this responsibility action");
            }
            requireEligibleTarget(identity.tenantId(), command.facilityId(), command.targetUserId());
            String scope = "CLINICAL_TASK_" + action.name();
            String requestHash = sha256(taskId + "|" + command.expectedRowVersion() + "|" + action + "|"
                    + command.targetUserId() + "|" + command.reason() + "|" + command.validUntil());
            beginCommand(identity, scope, idempotencyKey, requestHash);

            String nextState = action == Collaboration.DELEGATE ? "ASSIGNED"
                    : action == Collaboration.TRANSFER ? "CLAIMED" : "ESCALATED";
            UUID nextClaimedBy = action == Collaboration.DELEGATE ? null
                    : action == Collaboration.TRANSFER ? command.targetUserId() : task.claimedBy();
            OffsetDateTime validUntil = command.validUntil() == null
                    ? null : command.validUntil().atOffset(ZoneOffset.UTC);
            long nextVersion = jdbc.sql("""
                    update clinical_task set state = :state, assigned_user_id = :target,
                      claimed_by = cast(:claimed_by as uuid), row_version = row_version + 1, updated_at = now()
                    where tenant_id = :tenant and task_id = :task_id and row_version = :expected
                    returning row_version
                    """).param("state", nextState).param("target", command.targetUserId())
                    .param("claimed_by", nextClaimedBy).param("tenant", identity.tenantId())
                    .param("task_id", taskId).param("expected", command.expectedRowVersion())
                    .query(Long.class).optional().orElseThrow(() -> new ClinicalTaskException(
                            "CLINICAL_TASK_VERSION_CONFLICT", 409, "The task changed; reload before continuing"));
            if (action == Collaboration.DELEGATE) {
                jdbc.sql("""
                        insert into clinical_task_delegation(
                          tenant_id, delegation_id, task_id, delegated_by, delegated_to, reason, valid_until)
                        values (:tenant, gen_random_uuid(), :task_id, :actor, :target, :reason, :valid_until)
                        """).param("tenant", identity.tenantId()).param("task_id", taskId)
                        .param("actor", identity.userId()).param("target", command.targetUserId())
                        .param("reason", command.reason()).param("valid_until", validUntil).update();
            }
            jdbc.sql("""
                    insert into clinical_task_event(
                      tenant_id, task_event_id, task_id, event_type, previous_state, resulting_state,
                      actor_user_id, target_user_id, reason, valid_until)
                    values (:tenant, gen_random_uuid(), :task_id, :event_type, :previous, :resulting,
                      :actor, :target, :reason, cast(:valid_until as timestamptz))
                    """).param("tenant", identity.tenantId()).param("task_id", taskId)
                    .param("event_type", action.eventType()).param("previous", task.state())
                    .param("resulting", nextState).param("actor", identity.userId())
                    .param("target", command.targetUserId()).param("reason", command.reason())
                    .param("valid_until", validUntil).update();
            appendEvidence(identity, command.patientId(), taskId, task.sourceId(), nextVersion,
                    action.eventType(), command.targetUserId(), command.reason());
            completeCommand(identity, scope, idempotencyKey, taskId);
            return snapshot(identity.tenantId(), taskId, command.patientId(), command.encounterId(), command.facilityId());
        });
    }

    private void validateCollaboration(
            ClinicalIdentity identity, ClinicalTaskCollaborationRequestWire command, Collaboration action) {
        if (command.expectedRowVersion() == null || command.expectedRowVersion() <= 0
                || command.targetUserId() == null || command.reason() == null
                || command.reason().trim().length() < 2 || command.reason().length() > 1000) {
            throw new ClinicalTaskException(
                    "CLINICAL_TASK_COLLABORATION_INVALID", 400,
                    "A target, reason and positive expected task version are required");
        }
        if (identity.userId().equals(command.targetUserId())) {
            throw new ClinicalTaskException(
                    "CLINICAL_TASK_TARGET_INVALID", 400, "Task responsibility cannot target the current owner");
        }
        if (action == Collaboration.DELEGATE) {
            if (command.validUntil() == null || !command.validUntil().isAfter(Instant.now())) {
                throw new ClinicalTaskException(
                        "CLINICAL_TASK_DELEGATION_EXPIRY_INVALID", 400,
                        "Delegation requires a future valid_until value");
            }
        } else if (command.validUntil() != null) {
            throw new ClinicalTaskException(
                    "CLINICAL_TASK_COLLABORATION_INVALID", 400,
                    "Only delegation accepts valid_until");
        }
    }

    private void requireEligibleTarget(UUID tenantId, UUID facilityId, UUID targetUserId) {
        long count = jdbc.sql("""
                select count(*) from app_user u
                where u.tenant_id = :tenant and u.user_id = :target and u.status = 'ACTIVE'
                  and exists (
                    select 1 from role_assignment r
                    where r.tenant_id = u.tenant_id and r.user_id = u.user_id
                      and r.facility_id = :facility and r.status = 'ACTIVE'
                      and r.valid_from <= now() and (r.valid_until is null or r.valid_until > now()))
                """).param("tenant", tenantId).param("target", targetUserId)
                .param("facility", facilityId).query(Long.class).single();
        if (count != 1) {
            throw new ClinicalTaskException(
                    "CLINICAL_TASK_TARGET_NOT_ELIGIBLE", 403,
                    "The target user has no active assignment in this facility");
        }
    }

    private LockedTask lockTask(
            UUID tenantId, UUID taskId, UUID patientId, UUID encounterId, UUID facilityId) {
        return jdbc.sql("""
                select state, source_id, assigned_user_id, claimed_by, row_version from clinical_task
                where tenant_id = :tenant and task_id = :task_id and patient_id = :patient
                  and encounter_id = :encounter and facility_id = :facility for update
                """).param("tenant", tenantId).param("task_id", taskId).param("patient", patientId)
                .param("encounter", encounterId).param("facility", facilityId)
                .query((rs, row) -> new LockedTask(
                        rs.getString("state"), rs.getObject("source_id", UUID.class),
                        rs.getObject("assigned_user_id", UUID.class), rs.getObject("claimed_by", UUID.class),
                        rs.getLong("row_version")))
                .optional().orElseThrow(ClinicalTaskService::contextDenied);
    }

    private ClinicalTaskWire snapshot(
            UUID tenantId, UUID taskId, UUID patientId, UUID encounterId, UUID facilityId) {
        return jdbc.sql("""
                select task_id, patient_id, encounter_id, source_type, source_id, task_type,
                  title, risk_level, state, business_state, assigned_user_id, claimed_by,
                  due_at, source_route, row_version
                from clinical_task where tenant_id = :tenant and task_id = :task_id
                  and patient_id = :patient and encounter_id = :encounter and facility_id = :facility
                """).param("tenant", tenantId).param("task_id", taskId).param("patient", patientId)
                .param("encounter", encounterId).param("facility", facilityId)
                .query((rs, row) -> {
                    long version = rs.getLong("row_version");
                    String state = rs.getString("state");
                    String businessState = rs.getString("business_state");
                    UUID sourceId = rs.getObject("source_id", UUID.class);
                    OffsetDateTime dueAt = rs.getObject("due_at", OffsetDateTime.class);
                    String watermark = sha256(taskId + "|" + version + "|" + state + "|" + businessState
                            + "|" + sourceId);
                    return new ClinicalTaskWire(
                            taskId, rs.getObject("patient_id", UUID.class),
                            rs.getObject("encounter_id", UUID.class),
                            ClinicalTaskWire.SourceTypeValue.valueOf(rs.getString("source_type")), sourceId,
                            rs.getString("task_type"), rs.getString("title"),
                            ClinicalTaskWire.RiskLevelValue.valueOf(rs.getString("risk_level")),
                            ClinicalTaskWire.StateValue.valueOf(state), businessState,
                            rs.getObject("assigned_user_id", UUID.class), rs.getObject("claimed_by", UUID.class),
                            dueAt == null ? null : dueAt.toInstant(), rs.getString("source_route"), version, watermark);
                }).optional().orElseThrow(ClinicalTaskService::contextDenied);
    }

    private void requireEncounter(UUID tenantId, UUID patientId, UUID encounterId, UUID facilityId) {
        long count = jdbc.sql("""
                select count(*) from encounter where tenant_id = :tenant and encounter_id = :encounter
                  and patient_id = :patient and facility_id = :facility and status = 'IN_PROGRESS'
                """).param("tenant", tenantId).param("encounter", encounterId)
                .param("patient", patientId).param("facility", facilityId).query(Long.class).single();
        if (count != 1) throw contextDenied();
    }

    private void beginCommand(ClinicalIdentity identity, String scope, String key, String requestHash) {
        if (key == null || key.isBlank() || key.length() > 128) {
            throw new ClinicalTaskException("INVALID_IDEMPOTENCY_KEY", 400, "A valid Idempotency-Key is required");
        }
        int inserted = jdbc.sql("""
                insert into idempotency_record(
                  tenant_id, command_scope, idempotency_key, request_hash, state, trace_id, expires_at)
                values (:tenant, :scope, :key, :hash, 'IN_PROGRESS', :trace, now() + interval '24 hours')
                on conflict (tenant_id, command_scope, idempotency_key) do nothing
                """).param("tenant", identity.tenantId()).param("scope", scope).param("key", key)
                .param("hash", requestHash).param("trace", UUID.randomUUID().toString()).update();
        if (inserted != 1) {
            throw new ClinicalTaskException("IDEMPOTENCY_REPLAY", 409, "This task command key was already used");
        }
    }

    private void completeCommand(ClinicalIdentity identity, String scope, String key, UUID taskId) {
        jdbc.sql("""
                update idempotency_record set state = 'SUCCEEDED', response_status = 200,
                  response_ref = jsonb_build_object('resource_id', :resource)
                where tenant_id = :tenant and command_scope = :scope and idempotency_key = :key
                """).param("resource", taskId).param("tenant", identity.tenantId())
                .param("scope", scope).param("key", key).update();
    }

    private void appendEvidence(
            ClinicalIdentity identity, UUID patientId, UUID taskId, UUID sourceId,
            long taskVersion, String eventType, UUID targetUserId, String reason) {
        jdbc.sql("select tenant_id from tenant where tenant_id = :tenant for update")
                .param("tenant", identity.tenantId()).query(UUID.class).single();
        String previousHash = jdbc.sql("""
                select event_hash from audit_event where tenant_id = :tenant
                order by occurred_at desc, audit_event_id desc limit 1
                """).param("tenant", identity.tenantId()).query(String.class).optional().orElse(null);
        UUID auditId = UUID.randomUUID();
        String trace = UUID.randomUUID().toString();
        String action = "CLINICAL_TASK_" + eventType;
        String eventHash = sha256(identity.tenantId() + "|" + auditId + "|" + action + "|"
                + taskId + "|" + trace + "|" + (previousHash == null ? "GENESIS" : previousHash));
        jdbc.sql("""
                insert into audit_event(
                  tenant_id, audit_event_id, occurred_at, actor_user_id, action_code,
                  resource_type, resource_id, patient_ref_hash, trace_id, previous_hash, event_hash)
                values (:tenant, :audit, now(), :actor, :action, 'CLINICAL_TASK', :task_id,
                  :patient_hash, :trace, :previous, :event_hash)
                """).param("tenant", identity.tenantId()).param("audit", auditId)
                .param("actor", identity.userId()).param("action", action).param("task_id", taskId)
                .param("patient_hash", sha256(identity.tenantId() + "|" + patientId)).param("trace", trace)
                .param("previous", previousHash).param("event_hash", eventHash).update();
        jdbc.sql("""
                insert into outbox_event(
                  tenant_id, event_id, aggregate_type, aggregate_id, aggregate_version,
                  event_type, schema_version, payload)
                values (:tenant, gen_random_uuid(), 'CLINICAL_TASK', :task_id, :task_version,
                  :event_type, 1, jsonb_build_object('task_id', :task_id, 'source_id', :source_id,
                    'target_user_id', cast(:target_user_id as uuid), 'reason', cast(:reason as text)))
                """).param("tenant", identity.tenantId()).param("task_id", taskId)
                .param("task_version", taskVersion).param("event_type", "ClinicalTask" + title(eventType))
                .param("source_id", sourceId).param("target_user_id", targetUserId)
                .param("reason", reason).update();
    }

    static ClinicalTaskException contextDenied() {
        return new ClinicalTaskException(
                "CONTEXT_NOT_PERMITTED", 403, "The requested clinical task context is not permitted");
    }

    private static String title(String value) {
        return value.substring(0, 1) + value.substring(1).toLowerCase(java.util.Locale.ROOT);
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    private record LockedTask(
            String state, UUID sourceId, UUID assignedUserId, UUID claimedBy, long rowVersion) {}
    private record OverdueTask(UUID taskId, UUID patientId, UUID sourceId, String state, long rowVersion) {}
    private enum Action { VIEW, CLAIM }
    private enum Collaboration {
        DELEGATE("DELEGATED"), TRANSFER("TRANSFERRED"), ESCALATE("ESCALATED");

        private final String eventType;
        Collaboration(String eventType) { this.eventType = eventType; }
        String eventType() { return eventType; }
    }
}
