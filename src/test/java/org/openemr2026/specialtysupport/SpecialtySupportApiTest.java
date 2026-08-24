package org.openemr2026.specialtysupport;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("dev-synthetic")
final class SpecialtySupportApiTest {

    private static final String TENANT = "018f0000-0000-7000-8000-00000000aa01";
    private static final String ORGANIZATION = "018f0000-0000-7000-8000-00000000aa02";
    private static final String FACILITY = "018f0000-0000-7000-8000-00000000aa03";
    private static final String USER = "018f0000-0000-7000-8000-00000000aa04";
    private static final String ROLE = "018f0000-0000-7000-8000-00000000aa05";

    @LocalServerPort
    private int port;

    @Autowired
    private JdbcClient jdbc;

    @Autowired
    private ObjectMapper objectMapper;

    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    @Test
    void givenAnActivePackAndEvidence_whenAssessingADepartment_thenVersionAuditAndExpiryGuardAreEnforced()
            throws Exception {
        UUID departmentId = UUID.randomUUID();
        UUID packId = UUID.randomUUID();
        seedDepartmentAndPack(departmentId, packId);
        Lease lease = issueOrganizationLease();
        String path = "/api/v1/specialty-support/" + FACILITY + "/" + departmentId + "/OBGYN";
        String evidenceHash = "a".repeat(64);

        HttpResponse<String> created = send("PUT", path, """
                {"organization_id":"%s","support_level":"BASIC_CLOSED_LOOP",
                 "pack_release_id":"%s","evidence_bundle_hash":"%s",
                 "missing_safety_gates":[],"expires_at":"2027-08-14T00:00:00Z",
                 "expected_row_version":0}
                """.formatted(ORGANIZATION, packId, evidenceHash), lease, UUID.randomUUID().toString());

        assertThat(created.statusCode()).isEqualTo(200);
        assertThat(created.headers().firstValue("etag")).contains("\"1\"");
        JsonNode body = objectMapper.readTree(created.body());
        String assessmentId = body.path("department_support_assessment_id").stringValue();
        assertThat(body.path("support_level").stringValue()).isEqualTo("BASIC_CLOSED_LOOP");
        assertThat(body.path("missing_safety_gates").size()).isZero();
        assertThat(jdbc.sql("""
                select count(*) from audit_event where tenant_id = cast(:tenant as uuid)
                  and resource_id = cast(:assessment as uuid) and action_code = 'SPECIALTY_SUPPORT_ASSESSED'
                """).param("tenant", TENANT).param("assessment", assessmentId).query(Long.class).single()).isEqualTo(1);
        assertThat(jdbc.sql("""
                select count(*) from outbox_event where tenant_id = cast(:tenant as uuid)
                  and aggregate_id = cast(:assessment as uuid) and event_type = 'DepartmentSupportAssessed'
                """).param("tenant", TENANT).param("assessment", assessmentId).query(Long.class).single()).isEqualTo(1);

        HttpResponse<String> staleUpdate = send("PUT", path, """
                {"organization_id":"%s","support_level":"PACK_PENDING",
                 "pack_release_id":"%s","evidence_bundle_hash":null,
                 "missing_safety_gates":["DEVICE_INTERFACE"],"expires_at":null,
                 "expected_row_version":0}
                """.formatted(ORGANIZATION, packId), lease, UUID.randomUUID().toString());
        assertThat(staleUpdate.statusCode()).isEqualTo(409);
        assertThat(staleUpdate.body()).contains("SUPPORT_VERSION_CONFLICT");

        jdbc.sql("""
                update department_support_assessment
                set assessed_at = now() - interval '2 days', expires_at = now() - interval '1 day'
                where tenant_id = cast(:tenant as uuid) and department_support_assessment_id = cast(:assessment as uuid)
                """).param("tenant", TENANT).param("assessment", assessmentId).update();
        HttpResponse<String> expired = send("GET", path, null, lease, null);
        assertThat(expired.statusCode()).isEqualTo(200);
        assertThat(expired.body()).contains("PACK_PENDING", "EVIDENCE_EXPIRED");
    }

    @Test
    void givenMissingEvidence_whenClaimingPositiveSupport_thenTheDeclarationIsRejected() throws Exception {
        UUID departmentId = UUID.randomUUID();
        seedDepartmentAndPack(departmentId, UUID.randomUUID());
        Lease lease = issueOrganizationLease();
        HttpResponse<String> response = send("PUT",
                "/api/v1/specialty-support/" + FACILITY + "/" + departmentId + "/MENTAL", """
                        {"organization_id":"%s","support_level":"BASIC_CLOSED_LOOP",
                         "pack_release_id":null,"evidence_bundle_hash":null,
                         "missing_safety_gates":["RESTRICTED_DATA_REVIEW"],
                         "expires_at":"2027-08-14T00:00:00Z","expected_row_version":0}
                        """.formatted(ORGANIZATION), lease, UUID.randomUUID().toString());

        assertThat(response.statusCode()).isEqualTo(409);
        assertThat(response.body()).contains("SAFETY_GATE_MISSING");
        assertThat(jdbc.sql("""
                select count(*) from department_support_assessment
                where tenant_id = cast(:tenant as uuid) and department_id = cast(:department as uuid)
                """).param("tenant", TENANT).param("department", departmentId).query(Long.class).single()).isZero();
    }

    private void seedDepartmentAndPack(UUID departmentId, UUID packId) {
        jdbc.sql("""
                insert into clinical_department(
                  tenant_id, facility_id, department_id, department_code, display_name, status)
                values (cast(:tenant as uuid), cast(:facility as uuid), :department,
                  :code, '合成专科', 'ACTIVE')
                """).param("tenant", TENANT).param("facility", FACILITY).param("department", departmentId)
                .param("code", "SYN-" + departmentId.toString().substring(0, 8)).update();
        jdbc.sql("""
                insert into specialty_pack_release(
                  tenant_id, specialty_pack_release_id, pack_code, semantic_version,
                  content_hash, manifest, lifecycle_status, compatibility_range, created_by)
                values (cast(:tenant as uuid), :pack, :code, '1.0.0', :hash,
                  '{"synthetic":true}', 'ACTIVE', '{"core":">=0.1"}', cast(:user as uuid))
                """).param("tenant", TENANT).param("pack", packId)
                .param("code", "PACK-" + packId.toString().substring(0, 8)).param("hash", "b".repeat(64))
                .param("user", USER).update();
    }

    private Lease issueOrganizationLease() throws Exception {
        HttpRequest request = baseRequest("/api/v1/context-leases")
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString("""
                        {"organization_id":"%s","facility_id":"%s","purpose_code":"CONFIGURATION_REVIEW"}
                        """.formatted(ORGANIZATION, FACILITY))).build();
        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        assertThat(response.statusCode()).isEqualTo(201);
        JsonNode json = objectMapper.readTree(response.body());
        return new Lease(json.path("lease_id").stringValue(), json.path("authorization_watermark").stringValue());
    }

    private HttpResponse<String> send(
            String method, String path, String body, Lease lease, String idempotencyKey) throws Exception {
        HttpRequest.Builder request = baseRequest(path)
                .header("X-Context-Lease-Id", lease.id())
                .header("X-Authorization-Watermark", lease.watermark())
                .header("X-Organization-Context", ORGANIZATION)
                .header("X-Facility-Context", FACILITY);
        if (idempotencyKey != null) {
            request.header("Idempotency-Key", idempotencyKey);
        }
        if (body != null) {
            request.header("Content-Type", "application/json")
                    .method(method, HttpRequest.BodyPublishers.ofString(body));
        } else {
            request.method(method, HttpRequest.BodyPublishers.noBody());
        }
        return http.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpRequest.Builder baseRequest(String path) {
        return HttpRequest.newBuilder(URI.create("http://127.0.0.1:" + port + path))
                .timeout(Duration.ofSeconds(10))
                .header("Authorization", "Bearer dev-synthetic-token")
                .header("X-OpenEMR-Tenant-Id", TENANT)
                .header("X-OpenEMR-User-Id", USER)
                .header("X-OpenEMR-Role-Assignment-Ids", ROLE);
    }

    private record Lease(String id, String watermark) {}
}
