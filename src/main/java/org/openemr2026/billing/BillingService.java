package org.openemr2026.billing;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import org.openemr2026.contracts.ChargeItemRequestWire;
import org.openemr2026.contracts.ChargeItemReverseRequestWire;
import org.openemr2026.contracts.ChargeItemWire;
import org.openemr2026.contracts.PriceCatalogVersionRequestWire;
import org.openemr2026.contracts.PriceCatalogVersionWire;
import org.openemr2026.security.ClinicalIdentity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
final class BillingService {
    private final JdbcClient jdbc;
    private final TransactionTemplate transactions;

    BillingService(JdbcClient jdbc, TransactionTemplate transactions) {
        this.jdbc = jdbc;
        this.transactions = transactions;
    }

    PriceCatalogVersionWire createPriceVersion(
            ClinicalIdentity identity, String idempotencyKey, PriceCatalogVersionRequestWire request) {
        if (request.itemCode() == null || request.itemCode().isBlank() || request.itemName() == null
                || request.itemName().isBlank() || request.unitPrice() == null || request.unitPrice() < 0
                || request.unit() == null || request.unit().isBlank() || request.effectiveFrom() == null
                || request.releaseVersion() == null || request.releaseVersion().isBlank()) {
            throw invalid("item_code, item_name, non-negative unit_price, unit, effective_from and release_version are required");
        }
        return transactions.execute(status -> {
            String requestHash = sha256(request.itemCode() + "|" + request.unitPrice() + "|" + request.unit()
                    + "|" + request.effectiveFrom() + "|" + request.releaseVersion());
            beginCommand(identity, "PRICE_VERSION_CREATE", idempotencyKey, requestHash);
            UUID versionId = UUID.randomUUID();
            jdbc.sql("""
                    insert into price_catalog_version(
                      tenant_id, price_version_id, catalog_code, item_code, item_name,
                      unit_price, unit, effective_from, release_version, status)
                    values (:tenant, :version, :catalog, :item_code, :item_name,
                      :unit_price, :unit, :effective_from, :release_version, 'ACTIVE')
                    """).param("tenant", identity.tenantId()).param("version", versionId)
                    .param("catalog", request.catalogCode()).param("item_code", request.itemCode())
                    .param("item_name", request.itemName()).param("unit_price", BigDecimal.valueOf(request.unitPrice()))
                    .param("unit", request.unit()).param("effective_from", request.effectiveFrom())
                    .param("release_version", request.releaseVersion()).update();
            appendEvidence(identity, null, versionId, 1, "PRICE_VERSION_CREATED", "PriceVersionCreated");
            completeCommand(identity, "PRICE_VERSION_CREATE", idempotencyKey, versionId);
            return priceVersion(identity.tenantId(), versionId);
        });
    }

    ChargeItemWire createCharge(ClinicalIdentity identity, String idempotencyKey, ChargeItemRequestWire request) {
        if (request.itemCode() == null || request.itemCode().isBlank() || request.quantity() == null
                || request.quantity() <= 0) {
            throw invalid("item_code and a positive quantity are required");
        }
        requireActiveEncounter(identity.tenantId(), request.patientId(), request.encounterId(), request.facilityId());
        return transactions.execute(status -> {
            beginCommand(identity, "CHARGE_CREATE", idempotencyKey,
                    sha256(request.itemCode() + "|" + request.quantity() + "|" + request.encounterId()));
            PriceSnapshot price = jdbc.sql("""
                    select item_name, unit_price, unit from price_catalog_version
                    where tenant_id = :tenant and item_code = :item_code and status = 'ACTIVE'
                      and effective_from <= current_date and (effective_to is null or effective_to >= current_date)
                    order by effective_from desc, created_at desc limit 1
                    """).param("tenant", identity.tenantId()).param("item_code", request.itemCode())
                    .query((rs, row) -> new PriceSnapshot(
                            rs.getString("item_name"), rs.getBigDecimal("unit_price"), rs.getString("unit")))
                    .optional().orElseThrow(() -> new BillingException(
                            "PRICE_NOT_AVAILABLE", 409, "No active price version exists for the item"));
            BigDecimal quantity = BigDecimal.valueOf(request.quantity());
            BigDecimal amount = quantity.multiply(price.unitPrice()).setScale(2, RoundingMode.HALF_UP);
            UUID chargeId = UUID.randomUUID();
            jdbc.sql("""
                    insert into charge_item(
                      tenant_id, charge_item_id, patient_id, encounter_id, facility_id,
                      item_code, item_name, quantity, unit_price, amount, unit, status, charged_at, charged_by)
                    values (:tenant, :charge, :patient, :encounter, :facility,
                      :item_code, :item_name, :quantity, :unit_price, :amount, :unit, 'CHARGED', now(), :actor)
                    """).param("tenant", identity.tenantId()).param("charge", chargeId)
                    .param("patient", request.patientId()).param("encounter", request.encounterId())
                    .param("facility", request.facilityId()).param("item_code", request.itemCode())
                    .param("item_name", price.itemName()).param("quantity", quantity)
                    .param("unit_price", price.unitPrice()).param("amount", amount)
                    .param("unit", price.unit()).param("actor", identity.userId()).update();
            appendEvidence(identity, request.patientId(), chargeId, 1, "CHARGE_CREATED", "ChargeCreated");
            completeCommand(identity, "CHARGE_CREATE", idempotencyKey, chargeId);
            return charge(identity.tenantId(), chargeId, request.patientId(), request.encounterId());
        });
    }

    ChargeItemWire reverseCharge(
            ClinicalIdentity identity, String idempotencyKey, UUID chargeId, ChargeItemReverseRequestWire request) {
        String reason = request.reason() == null ? null : request.reason().trim();
        if (reason == null || reason.length() < 2) throw invalid("a reversal reason is required");
        return transactions.execute(status -> {
            beginCommand(identity, "CHARGE_REVERSE", idempotencyKey,
                    sha256(chargeId + "|" + request.expectedRowVersion() + "|" + reason));
            ChargeHead current = jdbc.sql("""
                    select status, row_version, patient_id from charge_item
                    where tenant_id = :tenant and charge_item_id = :charge
                      and patient_id = :patient and encounter_id = :encounter
                      and facility_id = :facility for update
                    """).param("tenant", identity.tenantId()).param("charge", chargeId)
                    .param("patient", request.patientId()).param("encounter", request.encounterId())
                    .param("facility", request.facilityId())
                    .query((rs, row) -> new ChargeHead(
                            rs.getString("status"), rs.getLong("row_version"), rs.getObject("patient_id", UUID.class)))
                    .optional().orElseThrow(() -> contextDenied());
            if (request.expectedRowVersion() == null || current.rowVersion() != request.expectedRowVersion()) {
                throw new BillingException("CHARGE_VERSION_CONFLICT", 409, "The charge changed; reload before retrying");
            }
            if (!"CHARGED".equals(current.status())) {
                throw new BillingException("CHARGE_STATE_INVALID", 409, "Only a charged item can be reversed");
            }
            jdbc.sql("""
                    update charge_item set status = 'REVERSED', reversed_at = now(),
                      reversed_by = :actor, reverse_reason = :reason,
                      row_version = row_version + 1, updated_at = now()
                    where tenant_id = :tenant and charge_item_id = :charge and row_version = :expected
                    """).param("actor", identity.userId()).param("reason", reason)
                    .param("tenant", identity.tenantId()).param("charge", chargeId)
                    .param("expected", current.rowVersion()).update();
            appendEvidence(identity, current.patientId(), chargeId, current.rowVersion() + 1,
                    "CHARGE_REVERSED", "ChargeReversed");
            completeCommand(identity, "CHARGE_REVERSE", idempotencyKey, chargeId);
            return charge(identity.tenantId(), chargeId, request.patientId(), request.encounterId());
        });
    }

    List<ChargeItemWire> listCharges(
            ClinicalIdentity identity, UUID organizationId, UUID facilityId, UUID patientId, UUID encounterId) {
        requireActiveEncounter(identity.tenantId(), patientId, encounterId, facilityId);
        return jdbc.sql("""
                select charge_item_id from charge_item
                where tenant_id = :tenant and patient_id = :patient
                  and encounter_id = :encounter and facility_id = :facility
                order by charged_at desc, charge_item_id desc limit 500
                """).param("tenant", identity.tenantId()).param("patient", patientId)
                .param("encounter", encounterId).param("facility", facilityId)
                .query(UUID.class).list().stream()
                .map(id -> charge(identity.tenantId(), id, patientId, encounterId)).toList();
    }

    private PriceCatalogVersionWire priceVersion(UUID tenantId, UUID versionId) {
        return jdbc.sql("""
                select price_version_id, catalog_code, item_code, item_name, unit_price, unit,
                  effective_from, effective_to, release_version, status
                from price_catalog_version where tenant_id = :tenant and price_version_id = :version
                """).param("tenant", tenantId).param("version", versionId)
                .query((rs, row) -> new PriceCatalogVersionWire(
                        rs.getObject("price_version_id", UUID.class), rs.getString("catalog_code"),
                        rs.getString("item_code"), rs.getString("item_name"),
                        nullableDouble(rs.getBigDecimal("unit_price")), rs.getString("unit"),
                        rs.getObject("effective_from", java.time.LocalDate.class),
                        rs.getObject("effective_to", java.time.LocalDate.class), rs.getString("release_version"),
                        PriceCatalogVersionWire.StatusValue.valueOf(rs.getString("status"))))
                .optional().orElseThrow(() -> contextDenied());
    }

    private ChargeItemWire charge(UUID tenantId, UUID chargeId, UUID patientId, UUID encounterId) {
        return jdbc.sql("""
                select charge_item_id, patient_id, encounter_id, facility_id, item_code, item_name,
                  quantity, unit_price, amount, unit, status, charged_at, charged_by,
                  reversed_at, reversed_by, reverse_reason, row_version
                from charge_item
                where tenant_id = :tenant and charge_item_id = :charge
                  and patient_id = :patient and encounter_id = :encounter
                """).param("tenant", tenantId).param("charge", chargeId)
                .param("patient", patientId).param("encounter", encounterId)
                .query((rs, row) -> new ChargeItemWire(
                        rs.getObject("charge_item_id", UUID.class), rs.getObject("patient_id", UUID.class),
                        rs.getObject("encounter_id", UUID.class), rs.getObject("facility_id", UUID.class),
                        rs.getString("item_code"), rs.getString("item_name"),
                        nullableDouble(rs.getBigDecimal("quantity")), nullableDouble(rs.getBigDecimal("unit_price")),
                        nullableDouble(rs.getBigDecimal("amount")), rs.getString("unit"),
                        ChargeItemWire.StatusValue.valueOf(rs.getString("status")),
                        rs.getObject("charged_at", OffsetDateTime.class).toInstant(),
                        rs.getObject("charged_by", UUID.class),
                        rs.getObject("reversed_at", OffsetDateTime.class) == null
                                ? null : rs.getObject("reversed_at", OffsetDateTime.class).toInstant(),
                        rs.getObject("reversed_by", UUID.class), rs.getString("reverse_reason"),
                        rs.getLong("row_version")))
                .optional().orElseThrow(() -> contextDenied());
    }

    private void requireActiveEncounter(UUID tenantId, UUID patientId, UUID encounterId, UUID facilityId) {
        long count = jdbc.sql("""
                select count(*) from encounter
                where tenant_id = :tenant and encounter_id = :encounter and patient_id = :patient
                  and facility_id = :facility and status in ('ARRIVED', 'IN_PROGRESS', 'SUSPENDED')
                """).param("tenant", tenantId).param("encounter", encounterId).param("patient", patientId)
                .param("facility", facilityId).query(Long.class).single();
        if (count != 1) throw contextDenied();
    }

    private void beginCommand(ClinicalIdentity identity, String scope, String key, String requestHash) {
        if (key == null || key.isBlank() || key.length() > 128) {
            throw new BillingException("INVALID_IDEMPOTENCY_KEY", 400, "A valid Idempotency-Key is required");
        }
        int inserted = jdbc.sql("""
                insert into idempotency_record(
                  tenant_id, command_scope, idempotency_key, request_hash, state, trace_id, expires_at)
                values (:tenant, :scope, :key, :hash, 'IN_PROGRESS', :trace, now() + interval '24 hours')
                on conflict (tenant_id, command_scope, idempotency_key) do nothing
                """).param("tenant", identity.tenantId()).param("scope", scope).param("key", key)
                .param("hash", requestHash).param("trace", UUID.randomUUID().toString()).update();
        if (inserted != 1) {
            throw new BillingException("IDEMPOTENCY_REPLAY", 409, "This command key was already used");
        }
    }

    private void completeCommand(ClinicalIdentity identity, String scope, String key, UUID resourceId) {
        jdbc.sql("""
                update idempotency_record set state = 'SUCCEEDED', response_status = 200,
                  response_ref = jsonb_build_object('resource_id', :resource)
                where tenant_id = :tenant and command_scope = :scope and idempotency_key = :key
                """).param("resource", resourceId).param("tenant", identity.tenantId())
                .param("scope", scope).param("key", key).update();
    }

    private void appendEvidence(
            ClinicalIdentity identity, UUID patientId, UUID resourceId, long version,
            String action, String eventType) {
        jdbc.sql("select tenant_id from tenant where tenant_id = :tenant for update")
                .param("tenant", identity.tenantId()).query(UUID.class).single();
        String previousHash = jdbc.sql("""
                select event_hash from audit_event where tenant_id = :tenant
                order by occurred_at desc, audit_event_id desc limit 1
                """).param("tenant", identity.tenantId()).query(String.class).optional().orElse(null);
        UUID auditId = UUID.randomUUID();
        String trace = UUID.randomUUID().toString();
        String eventHash = sha256(identity.tenantId() + "|" + auditId + "|" + action + "|"
                + resourceId + "|" + trace + "|" + (previousHash == null ? "GENESIS" : previousHash));
        jdbc.sql("""
                insert into audit_event(
                  tenant_id, audit_event_id, occurred_at, actor_user_id, action_code,
                  resource_type, resource_id, patient_ref_hash, trace_id, previous_hash, event_hash)
                values (:tenant, :audit, now(), :actor, :action, 'CHARGE', :resource,
                  :patient_hash, :trace, :previous, :event_hash)
                """).param("tenant", identity.tenantId()).param("audit", auditId)
                .param("actor", identity.userId()).param("action", action).param("resource", resourceId)
                .param("patient_hash", patientId == null ? null : sha256(identity.tenantId() + "|" + patientId))
                .param("trace", trace).param("previous", previousHash).param("event_hash", eventHash).update();
        jdbc.sql("""
                insert into outbox_event(
                  tenant_id, event_id, aggregate_type, aggregate_id, aggregate_version,
                  event_type, schema_version, payload)
                values (:tenant, :event, 'CHARGE', :aggregate, :version, :event_type, 1,
                  jsonb_build_object('resource_id', :aggregate))
                """).param("tenant", identity.tenantId()).param("event", UUID.randomUUID())
                .param("aggregate", resourceId).param("version", version).param("event_type", eventType).update();
    }

    private static Double nullableDouble(BigDecimal value) {
        return value == null ? null : value.doubleValue();
    }

    private static BillingException invalid(String message) {
        return new BillingException("CHARGE_REQUEST_INVALID", 400, message);
    }

    static BillingException contextDenied() {
        return new BillingException("CONTEXT_NOT_PERMITTED", 403, "The requested charge context is not permitted");
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    private record PriceSnapshot(String itemName, BigDecimal unitPrice, String unit) {}
    private record ChargeHead(String status, long rowVersion, UUID patientId) {}
}
