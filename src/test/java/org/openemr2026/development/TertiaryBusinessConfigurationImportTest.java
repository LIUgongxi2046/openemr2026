package org.openemr2026.development;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("dev-synthetic")
@Transactional
final class TertiaryBusinessConfigurationImportTest {

    @Autowired
    private JdbcClient jdbc;

    @Test
    void devSyntheticProfileImportsCompleteTertiaryHospitalBusinessConfiguration() {
        Map<String, Integer> payloadSizes = jdbc.sql("""
                select
                  max(case when config_type = 'WORKFLOW' then jsonb_array_length(payload->'nodes') end) as workflow_nodes,
                  max(case when config_type = 'FORM_TEMPLATE' then jsonb_array_length(payload->'fields') end) as form_fields,
                  max(case when config_type = 'RULE' then jsonb_array_length(payload->'rules') end) as rules,
                  max(case when config_type = 'SCOPE' then jsonb_array_length(payload->'permissions') end) as permissions
                from config_item
                where tenant_id = :tenant and status = 'ACTIVE'
                  and config_key in ('runtime-workflow-consult-v1', 'runtime-form-record-v1',
                    'runtime-rule-safety-v1', 'runtime-scope-clinical-v1')
                """).param("tenant", SyntheticDataImporter.TENANT_ID)
                .query((rs, row) -> Map.of(
                        "workflow", rs.getInt("workflow_nodes"),
                        "form", rs.getInt("form_fields"),
                        "rules", rs.getInt("rules"),
                        "permissions", rs.getInt("permissions")))
                .single();
        assertThat(payloadSizes).containsEntry("workflow", 14).containsEntry("form", 26)
                .containsEntry("rules", 14).containsEntry("permissions", 14);

        Integer activePacks = jdbc.sql("""
                select count(*) from capability_pack
                where tenant_id = :tenant and status = 'ACTIVE' and pack_code like 'SYN-%'
                """).param("tenant", SyntheticDataImporter.TENANT_ID).query(Integer.class).single();
        Integer activeCompositions = jdbc.sql("""
                select count(*) from config_item
                where tenant_id = :tenant and config_type = 'CAPABILITY_PACK_COMPOSITION'
                  and status = 'ACTIVE' and config_key like 'composition-syn-%'
                """).param("tenant", SyntheticDataImporter.TENANT_ID).query(Integer.class).single();
        assertThat(activePacks).isGreaterThanOrEqualTo(15);
        assertThat(activeCompositions).isGreaterThanOrEqualTo(15);

        Map<String, Integer> specialtyCoverage = jdbc.sql("""
                select count(*) as assessments, count(distinct department_id) as departments,
                  count(*) filter (where support_level in ('GENERAL_AVAILABLE','BASIC_CLOSED_LOOP')) as supported,
                  coalesce(sum(cardinality(missing_safety_gates)), 0) as missing_gates,
                  count(*) filter (where evidence_bundle_hash ~ '^[0-9a-f]{64}$'
                    and expires_at > now() + interval '300 days') as valid_evidence
                from department_support_assessment
                where tenant_id = :tenant
                  and department_support_assessment_id between
                    '018f0000-0000-7000-8000-00000000c411'::uuid and
                    '018f0000-0000-7000-8000-00000000c420'::uuid
                """).param("tenant", SyntheticDataImporter.TENANT_ID)
                .query((rs, row) -> Map.of(
                        "assessments", rs.getInt("assessments"),
                        "departments", rs.getInt("departments"),
                        "supported", rs.getInt("supported"),
                        "missing", rs.getInt("missing_gates"),
                        "evidence", rs.getInt("valid_evidence")))
                .single();
        assertThat(specialtyCoverage).containsEntry("assessments", 16)
                .containsEntry("departments", 16)
                .containsEntry("supported", 16)
                .containsEntry("missing", 0)
                .containsEntry("evidence", 16);
    }

    @Test
    void catalogPayloadsRemainInternallyCompleteAndDeterministic() {
        assertThat(TertiaryBusinessConfigurationCatalog.configurations()).hasSize(4)
                .allSatisfy(seed -> assertThat(seed.payload())
                        .containsKeys("schema_version", "description", "controls", "evidence"));
        assertThat(TertiaryBusinessConfigurationCatalog.capabilityPacks()).hasSize(15)
                .extracting(TertiaryBusinessConfigurationCatalog.CapabilityPackSeed::packCode)
                .doesNotHaveDuplicates();
        assertThat(TertiaryBusinessConfigurationCatalog.specialties()).hasSize(16)
                .allSatisfy(seed -> {
                    assertThat(seed.evidenceHash()).matches("[0-9a-f]{64}");
                    assertThat(seed.modules()).isNotEmpty();
                });
    }
}
