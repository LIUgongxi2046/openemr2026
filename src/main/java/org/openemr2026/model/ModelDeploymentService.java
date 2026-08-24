package org.openemr2026.model;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import org.openemr2026.contracts.ModelDeploymentDeactivateRequestWire;
import org.openemr2026.contracts.ModelDeploymentRegisterRequestWire;
import org.openemr2026.contracts.ModelDeploymentWire;
import org.openemr2026.security.ClinicalIdentity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
final class ModelDeploymentService {
    private final JdbcClient jdbc;
    private final TransactionTemplate transactions;

    ModelDeploymentService(JdbcClient jdbc, TransactionTemplate transactions) {
        this.jdbc = jdbc;
        this.transactions = transactions;
    }

    ModelDeploymentWire register(
            ClinicalIdentity identity, String idempotencyKey, ModelDeploymentRegisterRequestWire request) {
        if (request.modelCode() == null || request.modelCode().isBlank() || request.providerCode() == null
                || request.providerCode().isBlank() || request.displayName() == null || request.displayName().isBlank()
                || request.residencyPolicy() == null) {
            throw invalid("model_code, provider_code, display_name and residency_policy are required");
        }
        return transactions.execute(status -> {
            beginCommand(identity, "MODEL_DEPLOYMENT_REGISTER", idempotencyKey,
                    sha256(request.modelCode() + "|" + request.providerCode() + "|" + request.residencyPolicy()));
            UUID deploymentId = UUID.randomUUID();
            jdbc.sql("""
                    insert into model_deployment(
                      tenant_id, model_deployment_id, model_code, provider_code, display_name,
                      residency_policy, endpoint_url, status, evaluation_status)
                    values (:tenant, :deployment, :model_code, :provider_code, :display_name,
                      :residency_policy, :endpoint_url, 'ACTIVE', 'EVALUATING')
                    """).param("tenant", identity.tenantId()).param("deployment", deploymentId)
                    .param("model_code", request.modelCode()).param("provider_code", request.providerCode())
                    .param("display_name", request.displayName().trim())
                    .param("residency_policy", request.residencyPolicy().name())
                    .param("endpoint_url", request.endpointUrl()).update();
            appendEvidence(identity, deploymentId, 1, "MODEL_DEPLOYMENT_REGISTERED", "ModelDeploymentRegistered");
            completeCommand(identity, "MODEL_DEPLOYMENT_REGISTER", idempotencyKey, deploymentId);
            return deployment(identity.tenantId(), deploymentId);
        });
    }

    ModelDeploymentWire deactivate(
            ClinicalIdentity identity, String idempotencyKey, UUID deploymentId,
            ModelDeploymentDeactivateRequestWire request) {
        return transactions.execute(status -> {
            beginCommand(identity, "MODEL_DEPLOYMENT_DEACTIVATE", idempotencyKey,
                    sha256(deploymentId + "|" + request.expectedRowVersion()));
            DeploymentHead current = jdbc.sql("""
                    select status, row_version from model_deployment
                    where tenant_id = :tenant and model_deployment_id = :deployment for update
                    """).param("tenant", identity.tenantId()).param("deployment", deploymentId)
                    .query((rs, row) -> new DeploymentHead(rs.getString("status"), rs.getLong("row_version")))
                    .optional().orElseThrow(() -> contextDenied());
            if (request.expectedRowVersion() == null || current.rowVersion() != request.expectedRowVersion()) {
                throw new ModelDeploymentException("MODEL_DEPLOYMENT_VERSION_CONFLICT", 409, "The model deployment changed; reload before retrying");
            }
            if (!"ACTIVE".equals(current.status())) {
                throw new ModelDeploymentException("MODEL_DEPLOYMENT_STATE_INVALID", 409, "Only an active model can be deactivated");
            }
            jdbc.sql("""
                    update model_deployment set status = 'INACTIVE', row_version = row_version + 1, updated_at = now()
                    where tenant_id = :tenant and model_deployment_id = :deployment and row_version = :expected
                    """).param("tenant", identity.tenantId()).param("deployment", deploymentId)
                    .param("expected", current.rowVersion()).update();
            appendEvidence(identity, deploymentId, current.rowVersion() + 1,
                    "MODEL_DEPLOYMENT_DEACTIVATED", "ModelDeploymentDeactivated");
            completeCommand(identity, "MODEL_DEPLOYMENT_DEACTIVATE", idempotencyKey, deploymentId);
            return deployment(identity.tenantId(), deploymentId);
        });
    }

    List<ModelDeploymentWire> list(ClinicalIdentity identity) {
        return jdbc.sql("""
                select model_deployment_id from model_deployment
                where tenant_id = :tenant order by model_code, model_deployment_id
                """).param("tenant", identity.tenantId()).query(UUID.class).list().stream()
                .map(id -> deployment(identity.tenantId(), id)).toList();
    }

    private ModelDeploymentWire deployment(UUID tenantId, UUID deploymentId) {
        return jdbc.sql("""
                select model_deployment_id, model_code, provider_code, display_name, residency_policy,
                  endpoint_url, status, evaluation_status, row_version
                from model_deployment where tenant_id = :tenant and model_deployment_id = :deployment
                """).param("tenant", tenantId).param("deployment", deploymentId)
                .query((rs, row) -> new ModelDeploymentWire(
                        rs.getObject("model_deployment_id", UUID.class), rs.getString("model_code"),
                        rs.getString("provider_code"), rs.getString("display_name"),
                        ModelDeploymentWire.ResidencyPolicyValue.valueOf(rs.getString("residency_policy")),
                        rs.getString("endpoint_url"),
                        ModelDeploymentWire.StatusValue.valueOf(rs.getString("status")),
                        ModelDeploymentWire.EvaluationStatusValue.valueOf(rs.getString("evaluation_status")),
                        rs.getLong("row_version")))
                .optional().orElseThrow(() -> contextDenied());
    }

    private void beginCommand(ClinicalIdentity identity, String scope, String key, String requestHash) {
        if (key == null || key.isBlank() || key.length() > 128) {
            throw new ModelDeploymentException("INVALID_IDEMPOTENCY_KEY", 400, "A valid Idempotency-Key is required");
        }
        int inserted = jdbc.sql("""
                insert into idempotency_record(
                  tenant_id, command_scope, idempotency_key, request_hash, state, trace_id, expires_at)
                values (:tenant, :scope, :key, :hash, 'IN_PROGRESS', :trace, now() + interval '24 hours')
                on conflict (tenant_id, command_scope, idempotency_key) do nothing
                """).param("tenant", identity.tenantId()).param("scope", scope).param("key", key)
                .param("hash", requestHash).param("trace", UUID.randomUUID().toString()).update();
        if (inserted != 1) {
            throw new ModelDeploymentException("IDEMPOTENCY_REPLAY", 409, "This command key was already used");
        }
    }

    private void completeCommand(ClinicalIdentity identity, String scope, String key, UUID deploymentId) {
        jdbc.sql("""
                update idempotency_record set state = 'SUCCEEDED', response_status = 200,
                  response_ref = jsonb_build_object('resource_id', :resource)
                where tenant_id = :tenant and command_scope = :scope and idempotency_key = :key
                """).param("resource", deploymentId).param("tenant", identity.tenantId())
                .param("scope", scope).param("key", key).update();
    }

    private void appendEvidence(ClinicalIdentity identity, UUID deploymentId, long version, String action, String eventType) {
        jdbc.sql("select tenant_id from tenant where tenant_id = :tenant for update")
                .param("tenant", identity.tenantId()).query(UUID.class).single();
        String previousHash = jdbc.sql("""
                select event_hash from audit_event where tenant_id = :tenant
                order by occurred_at desc, audit_event_id desc limit 1
                """).param("tenant", identity.tenantId()).query(String.class).optional().orElse(null);
        UUID auditId = UUID.randomUUID();
        String trace = UUID.randomUUID().toString();
        String eventHash = sha256(identity.tenantId() + "|" + auditId + "|" + action + "|"
                + deploymentId + "|" + trace + "|" + (previousHash == null ? "GENESIS" : previousHash));
        jdbc.sql("""
                insert into audit_event(
                  tenant_id, audit_event_id, occurred_at, actor_user_id, action_code,
                  resource_type, resource_id, patient_ref_hash, trace_id, previous_hash, event_hash)
                values (:tenant, :audit, now(), :actor, :action, 'MODEL_DEPLOYMENT', :resource,
                  null, :trace, :previous, :event_hash)
                """).param("tenant", identity.tenantId()).param("audit", auditId)
                .param("actor", identity.userId()).param("action", action).param("resource", deploymentId)
                .param("trace", trace).param("previous", previousHash).param("event_hash", eventHash).update();
        jdbc.sql("""
                insert into outbox_event(
                  tenant_id, event_id, aggregate_type, aggregate_id, aggregate_version,
                  event_type, schema_version, payload)
                values (:tenant, :event, 'MODEL_DEPLOYMENT', :aggregate, :version, :event_type, 1,
                  jsonb_build_object('resource_id', :aggregate))
                """).param("tenant", identity.tenantId()).param("event", UUID.randomUUID())
                .param("aggregate", deploymentId).param("version", version).param("event_type", eventType).update();
    }

    private static ModelDeploymentException invalid(String message) {
        return new ModelDeploymentException("MODEL_DEPLOYMENT_REQUEST_INVALID", 400, message);
    }

    static ModelDeploymentException contextDenied() {
        return new ModelDeploymentException("CONTEXT_NOT_PERMITTED", 403, "The requested model context is not permitted");
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    private record DeploymentHead(String status, long rowVersion) {}
}
