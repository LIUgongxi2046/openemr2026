package org.openemr2026.outpatient;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.openemr2026.contracts.OutpatientFollowupCompleteRequestWire;
import org.openemr2026.contracts.OutpatientFollowupCreateRequestWire;
import org.openemr2026.contracts.OutpatientFollowupWire;
import org.openemr2026.security.ClinicalIdentity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
final class OutpatientFollowupService {
    private final JdbcClient jdbc;
    private final TransactionTemplate transactions;

    OutpatientFollowupService(JdbcClient jdbc, TransactionTemplate transactions) {
        this.jdbc = jdbc;
        this.transactions = transactions;
    }

    List<OutpatientFollowupWire> list(ClinicalIdentity identity, UUID patientId) {
        return jdbc.sql("""
                select followup_id, patient_id, encounter_id, followup_type, content, outcome, status,
                       due_at, completed_at, row_version, created_at
                from outpatient_followup where tenant_id = :tenant and patient_id = :patient
                order by due_at desc nulls last, created_at desc limit 500
                """).param("tenant", identity.tenantId()).param("patient", patientId)
                .query((rs, row) -> wire(rs)).list();
    }

    OutpatientFollowupWire create(
            ClinicalIdentity identity, String idempotencyKey, OutpatientFollowupCreateRequestWire request) {
        return transactions.execute(status -> {
            int inserted = jdbc.sql("""
                    insert into idempotency_record(
                      tenant_id, command_scope, idempotency_key, request_hash, state, trace_id, expires_at)
                    values (:tenant, 'FOLLOWUP_CREATE', :key, :hash, 'IN_PROGRESS', :trace, now() + interval '24 hours')
                    on conflict (tenant_id, command_scope, idempotency_key) do nothing
                    """).param("tenant", identity.tenantId()).param("key", idempotencyKey)
                    .param("hash", sha256(idempotencyKey + "|" + request.patientId() + "|" + request.followupType().name()))
                    .param("trace", UUID.randomUUID().toString()).update();
            if (inserted != 1) {
                throw new OutpatientFollowupException("IDEMPOTENCY_REPLAY", 409, "该随访命令已提交");
            }
            UUID followupId = UUID.randomUUID();
            jdbc.sql("""
                    insert into outpatient_followup(
                      tenant_id, followup_id, patient_id, encounter_id, followup_type, content, due_at)
                    values (:tenant, :followup, :patient, :encounter, :type, :content, :due_at)
                    """).param("tenant", identity.tenantId()).param("followup", followupId)
                    .param("patient", request.patientId()).param("encounter", request.encounterId())
                    .param("type", request.followupType().name()).param("content", request.content())
                    .param("due_at", request.dueAt()).update();
            jdbc.sql("""
                    update idempotency_record set state = 'SUCCEEDED', response_status = 201,
                      response_ref = jsonb_build_object('followup_id', :followup)
                    where tenant_id = :tenant and command_scope = 'FOLLOWUP_CREATE' and idempotency_key = :key
                    """).param("followup", followupId).param("tenant", identity.tenantId())
                    .param("key", idempotencyKey).update();
            return item(identity.tenantId(), followupId);
        });
    }

    OutpatientFollowupWire complete(
            ClinicalIdentity identity, UUID followupId, OutpatientFollowupCompleteRequestWire request) {
        return transactions.execute(status -> {
            int updated = jdbc.sql("""
                    update outpatient_followup set status = 'COMPLETED', outcome = :outcome,
                      completed_at = now(), row_version = row_version + 1, updated_at = now()
                    where tenant_id = :tenant and followup_id = :followup and status = 'PENDING'
                      and row_version = :expected
                    """).param("outcome", request.outcome()).param("tenant", identity.tenantId())
                    .param("followup", followupId).param("expected", request.expectedRowVersion()).update();
            if (updated != 1) {
                throw new OutpatientFollowupException("FOLLOWUP_STATE_CONFLICT", 409,
                        "随访不存在、已完成或版本冲突");
            }
            return item(identity.tenantId(), followupId);
        });
    }

    private OutpatientFollowupWire item(UUID tenantId, UUID followupId) {
        return jdbc.sql("""
                select followup_id, patient_id, encounter_id, followup_type, content, outcome, status,
                       due_at, completed_at, row_version, created_at
                from outpatient_followup where tenant_id = :tenant and followup_id = :followup
                """).param("tenant", tenantId).param("followup", followupId)
                .query((rs, row) -> wire(rs))
                .optional().orElseThrow(() -> new OutpatientFollowupException(
                        "FOLLOWUP_NOT_FOUND", 404, "随访记录不存在"));
    }

    private OutpatientFollowupWire wire(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new OutpatientFollowupWire(
                rs.getObject("followup_id", UUID.class),
                rs.getObject("patient_id", UUID.class),
                rs.getObject("encounter_id", UUID.class),
                OutpatientFollowupWire.FollowupTypeValue.valueOf(rs.getString("followup_type")),
                rs.getString("content"),
                rs.getString("outcome"),
                OutpatientFollowupWire.StatusValue.valueOf(rs.getString("status")),
                rs.getObject("due_at", OffsetDateTime.class) == null ? null : rs.getObject("due_at", OffsetDateTime.class).toInstant(),
                rs.getObject("completed_at", OffsetDateTime.class) == null ? null : rs.getObject("completed_at", OffsetDateTime.class).toInstant(),
                rs.getLong("row_version"),
                rs.getObject("created_at", OffsetDateTime.class).toInstant());
    }

    private static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte b : digest) hex.append(String.format("%02x", b));
            return hex.toString();
        } catch (Exception impossible) {
            throw new IllegalStateException("SHA-256 unavailable", impossible);
        }
    }
}
