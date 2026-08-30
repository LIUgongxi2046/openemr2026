package org.openemr2026.organization;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openemr2026.security.ClinicalIdentity;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

@Service
final class CredentialAdministrationService {

    private static final List<String> ADMIN_ROLES = List.of("SYSTEM_ADMIN", "CLINICAL_ADMIN");
    private static final List<String> TYPES = List.of(
            "PHYSICIAN_LICENSE", "NURSE_LICENSE", "PHARMACIST_LICENSE", "TECHNICIAN_LICENSE", "OTHER");
    private final JdbcClient jdbc;
    private final TransactionTemplate transactions;
    private final ObjectMapper objectMapper;

    CredentialAdministrationService(JdbcClient jdbc, TransactionTemplate transactions, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.transactions = transactions;
        this.objectMapper = objectMapper;
    }

    List<PractitionerCredentialWire> list(ClinicalIdentity identity, UUID personId) {
        requireAdministrator(identity);
        String personFilter = personId == null ? "" : " and credential.person_id = :person";
        JdbcClient.StatementSpec statement = jdbc.sql("""
                select credential.credential_id, credential.person_id, person.display_name,
                  credential.credential_type, credential.registration_number, credential.issuing_authority,
                  credential.practice_scope::text, credential.status, credential.valid_from,
                  credential.valid_until, credential.row_version, credential.created_at, credential.updated_at
                from practitioner_credential credential
                join workforce_person person on person.tenant_id = credential.tenant_id
                  and person.person_id = credential.person_id
                where credential.tenant_id = :tenant
                """ + personFilter + " order by credential.updated_at desc, credential.credential_id")
                .param("tenant", identity.tenantId());
        if (personId != null) statement = statement.param("person", personId);
        return statement.query((rs, row) -> map(rs)).list();
    }

    PractitionerCredentialWire create(
            ClinicalIdentity identity, String idempotencyKey, CredentialWriteRequest request) {
        requireAdministrator(identity);
        validate(request, false);
        return transactions.execute(status -> {
            begin(identity, "CREDENTIAL_CREATE", idempotencyKey, hash(request));
            requireActivePerson(identity.tenantId(), request.personId());
            UUID credentialId = UUID.randomUUID();
            try {
                jdbc.sql("""
                        insert into practitioner_credential(
                          tenant_id, credential_id, person_id, credential_type, registration_number,
                          issuing_authority, practice_scope, status, valid_from, valid_until)
                        values (:tenant, :credential, :person, :type, :number, :authority,
                          cast(:scope as jsonb), 'ACTIVE', :valid_from, :valid_until)
                        """).param("tenant", identity.tenantId()).param("credential", credentialId)
                        .param("person", request.personId()).param("type", request.credentialType())
                        .param("number", request.registrationNumber().trim())
                        .param("authority", request.issuingAuthority().trim())
                        .param("scope", json(request.practiceScope())).param("valid_from", utc(request.validFrom()))
                        .param("valid_until", utc(request.validUntil())).update();
            } catch (DataIntegrityViolationException conflict) {
                throw new OrganizationAdministrationException(
                        "CREDENTIAL_CONFLICT", 409, "The credential registration already exists or violates its scope");
            }
            evidence(identity, credentialId, request.personId(), 1, "PRACTITIONER_CREDENTIAL_GRANTED");
            complete(identity, "CREDENTIAL_CREATE", idempotencyKey, credentialId);
            return get(identity, credentialId);
        });
    }

    PractitionerCredentialWire update(
            ClinicalIdentity identity, String idempotencyKey, UUID credentialId, CredentialWriteRequest request) {
        requireAdministrator(identity);
        validate(request, true);
        return transactions.execute(status -> {
            begin(identity, "CREDENTIAL_UPDATE", idempotencyKey, credentialId + "|" + hash(request));
            PractitionerCredentialWire current = get(identity, credentialId);
            if (!current.personId().equals(request.personId())) {
                throw invalid("Credential ownership cannot be changed");
            }
            int updated = jdbc.sql("""
                    update practitioner_credential set credential_type = :type,
                      registration_number = :number, issuing_authority = :authority,
                      practice_scope = cast(:scope as jsonb), valid_from = :valid_from,
                      valid_until = :valid_until, row_version = row_version + 1, updated_at = now()
                    where tenant_id = :tenant and credential_id = :credential
                      and status = 'ACTIVE' and row_version = :expected
                    """).param("type", request.credentialType()).param("number", request.registrationNumber().trim())
                    .param("authority", request.issuingAuthority().trim()).param("scope", json(request.practiceScope()))
                    .param("valid_from", utc(request.validFrom())).param("valid_until", utc(request.validUntil()))
                    .param("tenant", identity.tenantId()).param("credential", credentialId)
                    .param("expected", request.expectedRowVersion()).update();
            if (updated != 1) throw conflict();
            long version = request.expectedRowVersion() + 1;
            evidence(identity, credentialId, request.personId(), version, "PRACTITIONER_CREDENTIAL_UPDATED");
            complete(identity, "CREDENTIAL_UPDATE", idempotencyKey, credentialId);
            return get(identity, credentialId);
        });
    }

    PractitionerCredentialWire revoke(
            ClinicalIdentity identity, String idempotencyKey, UUID credentialId, CredentialRevokeRequest request) {
        requireAdministrator(identity);
        if (request == null || request.expectedRowVersion() < 1 || request.reason() == null
                || request.reason().trim().length() < 4 || request.reason().length() > 1000) {
            throw invalid("Expected version and a revocation reason of at least four characters are required");
        }
        return transactions.execute(status -> {
            begin(identity, "CREDENTIAL_REVOKE", idempotencyKey,
                    credentialId + "|" + request.expectedRowVersion() + "|" + request.reason().trim());
            PractitionerCredentialWire current = get(identity, credentialId);
            int updated = jdbc.sql("""
                    update practitioner_credential set status = 'REVOKED', valid_until = case
                        when valid_until is null or valid_until > now() then now() else valid_until end,
                      row_version = row_version + 1, updated_at = now()
                    where tenant_id = :tenant and credential_id = :credential
                      and status = 'ACTIVE' and row_version = :expected
                    """).param("tenant", identity.tenantId()).param("credential", credentialId)
                    .param("expected", request.expectedRowVersion()).update();
            if (updated != 1) throw conflict();
            long version = request.expectedRowVersion() + 1;
            evidence(identity, credentialId, current.personId(), version, "PRACTITIONER_CREDENTIAL_REVOKED");
            complete(identity, "CREDENTIAL_REVOKE", idempotencyKey, credentialId);
            return get(identity, credentialId);
        });
    }

    private PractitionerCredentialWire get(ClinicalIdentity identity, UUID credentialId) {
        return list(identity, null).stream().filter(item -> item.credentialId().equals(credentialId)).findFirst()
                .orElseThrow(() -> new OrganizationAdministrationException(
                        "CREDENTIAL_NOT_FOUND", 404, "The practitioner credential was not found"));
    }

    private void validate(CredentialWriteRequest request, boolean update) {
        if (request == null || request.personId() == null || !TYPES.contains(request.credentialType())
                || request.registrationNumber() == null || request.registrationNumber().isBlank()
                || request.issuingAuthority() == null || request.issuingAuthority().isBlank()
                || request.validFrom() == null || (request.validUntil() != null && !request.validUntil().isAfter(request.validFrom()))
                || (update ? request.expectedRowVersion() < 1 : request.expectedRowVersion() != 0)) {
            throw invalid("Complete credential fields, a valid period and expected version are required");
        }
    }

    private void requireActivePerson(UUID tenantId, UUID personId) {
        long found = jdbc.sql("select count(*) from workforce_person where tenant_id = :tenant and person_id = :person and status = 'ACTIVE'")
                .param("tenant", tenantId).param("person", personId).query(Long.class).single();
        if (found != 1) throw new OrganizationAdministrationException(
                "CREDENTIAL_PERSON_INVALID", 409, "Credentials can only be granted to an active workforce person");
    }

    private void requireAdministrator(ClinicalIdentity identity) {
        long allowed = jdbc.sql("""
                select count(*) from role_assignment where tenant_id = :tenant and user_id = :user
                  and role_assignment_id in (:roles) and role_code in (:admin_roles)
                  and status = 'ACTIVE' and valid_from <= now()
                  and (valid_until is null or valid_until > now())
                """).param("tenant", identity.tenantId()).param("user", identity.userId())
                .param("roles", identity.roleAssignmentIds()).param("admin_roles", ADMIN_ROLES)
                .query(Long.class).single();
        if (identity.roleAssignmentIds().isEmpty() || allowed == 0) throw new OrganizationAdministrationException(
                "ADMIN_SCOPE_DENIED", 403, "The requested credential administration scope is not permitted");
    }

    private void begin(ClinicalIdentity identity, String scope, String key, String requestHash) {
        if (key == null || key.isBlank() || key.length() > 128) throw invalid("Idempotency-Key is required");
        int inserted = jdbc.sql("""
                insert into idempotency_record(
                  tenant_id, command_scope, idempotency_key, request_hash, state, trace_id, expires_at)
                values (:tenant, :scope, :key, :hash, 'IN_PROGRESS', :trace, now() + interval '24 hours')
                on conflict (tenant_id, command_scope, idempotency_key) do nothing
                """).param("tenant", identity.tenantId()).param("scope", scope).param("key", key)
                .param("hash", sha256(requestHash)).param("trace", UUID.randomUUID().toString()).update();
        if (inserted != 1) throw new OrganizationAdministrationException(
                "CREDENTIAL_IDEMPOTENCY_REPLAY", 409, "This credential command was already submitted");
    }

    private void complete(ClinicalIdentity identity, String scope, String key, UUID resourceId) {
        jdbc.sql("""
                update idempotency_record set state = 'SUCCEEDED', response_status = 200,
                  response_ref = jsonb_build_object('resource_id', :resource)
                where tenant_id = :tenant and command_scope = :scope and idempotency_key = :key
                """).param("resource", resourceId).param("tenant", identity.tenantId())
                .param("scope", scope).param("key", key).update();
    }

    private void evidence(ClinicalIdentity identity, UUID credentialId, UUID personId, long version, String action) {
        jdbc.sql("select tenant_id from tenant where tenant_id = :tenant for update")
                .param("tenant", identity.tenantId()).query(UUID.class).single();
        String previous = jdbc.sql("select event_hash from audit_event where tenant_id = :tenant order by occurred_at desc, audit_event_id desc limit 1")
                .param("tenant", identity.tenantId()).query(String.class).optional().orElse(null);
        UUID audit = UUID.randomUUID(); String trace = UUID.randomUUID().toString();
        String eventHash = sha256(identity.tenantId() + "|" + audit + "|" + action + "|" + credentialId + "|" + trace + "|" + (previous == null ? "GENESIS" : previous));
        jdbc.sql("""
                insert into audit_event(tenant_id, audit_event_id, occurred_at, actor_user_id,
                  action_code, resource_type, resource_id, trace_id, previous_hash, event_hash, details)
                values (:tenant, :audit, now(), :actor, :action, 'PRACTITIONER_CREDENTIAL',
                  :credential, :trace, :previous, :hash, jsonb_build_object('person_id', :person, 'row_version', :version))
                """).param("tenant", identity.tenantId()).param("audit", audit).param("actor", identity.userId())
                .param("action", action).param("credential", credentialId).param("trace", trace)
                .param("previous", previous).param("hash", eventHash).param("person", personId).param("version", version).update();
        jdbc.sql("""
                insert into outbox_event(tenant_id, event_id, aggregate_type, aggregate_id,
                  aggregate_version, event_type, schema_version, payload)
                values (:tenant, :event, 'PRACTITIONER_CREDENTIAL', :credential,
                  :version, :event_type, 1, jsonb_build_object('credential_id', :credential, 'person_id', :person))
                """).param("tenant", identity.tenantId()).param("event", UUID.randomUUID())
                .param("credential", credentialId).param("version", version).param("event_type", action)
                .param("person", personId).update();
    }

    @SuppressWarnings("unchecked")
    private PractitionerCredentialWire map(java.sql.ResultSet rs) throws java.sql.SQLException {
        Map<String, Object> scope;
        try { scope = objectMapper.convertValue(objectMapper.readTree(rs.getString("practice_scope")), Map.class); }
        catch (Exception invalid) { throw new java.sql.SQLException("Stored credential practice scope is invalid", invalid); }
        return new PractitionerCredentialWire(rs.getObject("credential_id", UUID.class), rs.getObject("person_id", UUID.class),
                rs.getString("display_name"), rs.getString("credential_type"), rs.getString("registration_number"),
                rs.getString("issuing_authority"), scope, rs.getString("status"),
                instant(rs.getObject("valid_from", OffsetDateTime.class)), instant(rs.getObject("valid_until", OffsetDateTime.class)),
                rs.getLong("row_version"), instant(rs.getObject("created_at", OffsetDateTime.class)), instant(rs.getObject("updated_at", OffsetDateTime.class)));
    }

    private String json(Map<String, Object> value) {
        try { return objectMapper.writeValueAsString(value == null ? Map.of() : value); }
        catch (Exception invalid) { throw invalid("Credential practice scope must be valid JSON"); }
    }
    private static String hash(CredentialWriteRequest request) {
        return request.personId() + "|" + request.credentialType() + "|" + request.registrationNumber() + "|"
                + request.issuingAuthority() + "|" + request.practiceScope() + "|" + request.validFrom() + "|"
                + request.validUntil() + "|" + request.expectedRowVersion();
    }
    private static OrganizationAdministrationException invalid(String message) { return new OrganizationAdministrationException("CREDENTIAL_REQUEST_INVALID", 400, message); }
    private static OrganizationAdministrationException conflict() { return new OrganizationAdministrationException("CREDENTIAL_VERSION_CONFLICT", 409, "The credential changed or is no longer active"); }
    private static OffsetDateTime utc(Instant value) { return value == null ? null : value.atOffset(ZoneOffset.UTC); }
    private static Instant instant(OffsetDateTime value) { return value == null ? null : value.toInstant(); }
    private static String sha256(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }

    record CredentialWriteRequest(UUID personId, String credentialType, String registrationNumber,
            String issuingAuthority, Map<String, Object> practiceScope, Instant validFrom,
            Instant validUntil, long expectedRowVersion) {}
    record CredentialRevokeRequest(long expectedRowVersion, String reason) {}
    record PractitionerCredentialWire(UUID credentialId, UUID personId, String personDisplayName,
            String credentialType, String registrationNumber, String issuingAuthority,
            Map<String, Object> practiceScope, String status, Instant validFrom, Instant validUntil,
            long rowVersion, Instant createdAt, Instant updatedAt) {}
}
