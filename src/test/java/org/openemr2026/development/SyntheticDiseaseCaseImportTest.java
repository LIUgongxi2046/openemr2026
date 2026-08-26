package org.openemr2026.development;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("dev-synthetic")
final class SyntheticDiseaseCaseImportTest {

    @Autowired
    private JdbcClient jdbc;

    @Test
    void importsFiftyCompleteDiseaseCasesAcrossAllThreeClinicalDomains() {
        Map<String, Long> domainCounts = jdbc.sql("""
                select encounter_type, count(*)
                from encounter
                where tenant_id = :tenant and source_system = 'SYNTHETIC-50'
                group by encounter_type
                """)
                .param("tenant", SyntheticDataImporter.TENANT_ID)
                .query((resultSet, rowNumber) -> Map.entry(
                        resultSet.getString(1), resultSet.getLong(2)))
                .list()
                .stream()
                .collect(java.util.stream.Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));

        assertThat(domainCounts).containsExactlyInAnyOrderEntriesOf(Map.of(
                "OUTPATIENT", 20L,
                "EMERGENCY", 15L,
                "INPATIENT", 15L));
        assertThat(count("""
                select count(distinct patient.display_name)
                from patient
                join encounter on encounter.tenant_id = patient.tenant_id
                  and encounter.patient_id = patient.patient_id
                where encounter.tenant_id = :tenant and encounter.source_system = 'SYNTHETIC-50'
                  and patient.display_name ~ '^[一-龥]{2,4}$'
                  and patient.display_name !~ '(合成|测试|患者)'
                """)).isEqualTo(50);
        assertThat(count("""
                select count(distinct version.code)
                from clinical_diagnosis diagnosis
                join encounter on encounter.tenant_id = diagnosis.tenant_id
                  and encounter.encounter_id = diagnosis.encounter_id
                join clinical_diagnosis_version version on version.tenant_id = diagnosis.tenant_id
                  and version.diagnosis_id = diagnosis.diagnosis_id
                where encounter.source_system = 'SYNTHETIC-50'
                """)).isEqualTo(50);
        assertThat(count("""
                select count(*) from clinical_document document
                join encounter on encounter.tenant_id = document.tenant_id
                  and encounter.encounter_id = document.encounter_id
                where encounter.source_system = 'SYNTHETIC-50'
                """)).isEqualTo(65);
        assertThat(count("""
                select count(*) from clinical_order orders
                join encounter on encounter.tenant_id = orders.tenant_id
                  and encounter.encounter_id = orders.encounter_id
                where encounter.source_system = 'SYNTHETIC-50'
                """)).isEqualTo(50);
        assertThat(count("""
                select count(*) from clinical_result result
                join encounter on encounter.tenant_id = result.tenant_id
                  and encounter.encounter_id = result.encounter_id
                where encounter.source_system = 'SYNTHETIC-50'
                """)).isEqualTo(50);
        assertThat(count("""
                select count(*) from waiting_queue_entry queue
                join appointment on appointment.tenant_id = queue.tenant_id
                  and appointment.appointment_id = queue.appointment_id
                join encounter on encounter.tenant_id = appointment.tenant_id
                  and encounter.encounter_id = appointment.encounter_id
                where encounter.source_system = 'SYNTHETIC-50'
                """)).isEqualTo(20);
        assertThat(count("""
                select count(*) from emergency_triage_assessment triage
                join encounter on encounter.tenant_id = triage.tenant_id
                  and encounter.encounter_id = triage.encounter_id
                where encounter.source_system = 'SYNTHETIC-50'
                """)).isEqualTo(15);
        assertThat(count("""
                select count(*) from emergency_nursing_note note
                join encounter on encounter.tenant_id = note.tenant_id
                  and encounter.encounter_id = note.encounter_id
                where encounter.source_system = 'SYNTHETIC-50'
                """)).isEqualTo(15);
        assertThat(count("""
                select count(*) from emergency_observation observation
                join encounter on encounter.tenant_id = observation.tenant_id
                  and encounter.encounter_id = observation.encounter_id
                where encounter.source_system = 'SYNTHETIC-50'
                """)).isEqualTo(15);
        assertThat(count("""
                select count(*) from inpatient_admission admission
                join encounter on encounter.tenant_id = admission.tenant_id
                  and encounter.encounter_id = admission.encounter_id
                where encounter.source_system = 'SYNTHETIC-50'
                """)).isEqualTo(15);
        assertThat(count("""
                select count(*)
                from encounter
                where tenant_id = :tenant and source_system = 'SYNTHETIC-50'
                  and not exists (
                    select 1 from clinical_diagnosis diagnosis
                    where diagnosis.tenant_id = encounter.tenant_id
                      and diagnosis.encounter_id = encounter.encounter_id)
                """)).isZero();
    }

    @Test
    void importsSystemAdministrationFixturesForEveryDatabaseBackedWorkbench() {
        assertThat(count("""
                select count(*) from dictionary_item
                where tenant_id = :tenant and (
                  (dictionary_code = 'GENDER' and item_code in ('M', 'F', 'U')) or
                  (dictionary_code = 'ENCOUNTER_TYPE' and item_code in ('OPD', 'ED', 'IPD')) or
                  (dictionary_code = 'ALLERGY_SEVERITY' and item_code in ('MILD', 'MODERATE', 'SEVERE')) or
                  (dictionary_code = 'LAB_UNIT' and item_code in ('MMOL_L', 'MG_L')))
                """)).isEqualTo(11);
        assertThat(count("""
                select count(*) from authorization_policy
                where tenant_id = :tenant and policy_code in (
                  'CLINICAL-DOCUMENT-READ', 'CLINICAL-DOCUMENT-WRITE',
                  'SYSTEM-ADMIN-WORKFORCE', 'CROSS-DEPARTMENT-EXPORT-DENY',
                  'RESEARCH-DATASET-READ')
                """)).isEqualTo(5);
        assertThat(fixedConfigurationCount("MASTER_DATA", "c20[1-4]")).isEqualTo(4);
        assertThat(fixedConfigurationCount("PARAMETER", "c2(1[1-9]|20|3[0-2])")).isEqualTo(13);
        assertThat(fixedConfigurationCount("JOB", "c22[1-4]")).isEqualTo(4);
    }

    @Test
    void importsCompleteBusinessConfigurationFixturesWithVersionHistory() {
        assertThat(count("""
                select count(*) from config_item
                where tenant_id = :tenant and (
                  (config_type = 'WORKFLOW' and config_key = 'syn-workflow-closed-loop-v1'
                    and jsonb_exists_all(payload, array['nodes', 'edges', 'protected_nodes', 'timeout_policy'])) or
                  (config_type = 'FORM_TEMPLATE' and config_key = 'syn-medical-record-v1'
                    and jsonb_exists_all(payload, array['fields', 'groups', 'terminology_mapping', 'print_template'])) or
                  (config_type = 'RULE' and config_key = 'syn-clinical-safety-v1'
                    and jsonb_exists_all(payload, array['conditions', 'actions', 'rule_layer', 'sample_case'])) or
                  (config_type = 'SCOPE' and config_key = 'syn-role-scope-v1'
                    and jsonb_exists_all(payload, array['roles', 'data_scopes', 'separation_of_duties', 'temporary_grant_hours'])))
                """)).isEqualTo(4);
        assertThat(count("""
                select count(distinct item.config_id) from config_item_revision revision
                join config_item item on item.tenant_id = revision.tenant_id
                  and item.config_id = revision.config_id
                where item.tenant_id = :tenant and item.config_key in (
                  'syn-workflow-closed-loop-v1', 'syn-medical-record-v1',
                  'syn-clinical-safety-v1', 'syn-role-scope-v1')
                """)).isEqualTo(4);
        assertThat(count("""
                select count(*) from capability_pack
                where tenant_id = :tenant and pack_code in (
                  'SYN-CORE-CLINICAL', 'SYN-TERTIARY-HOSPITAL', 'SYN-CARDIOLOGY')
                """)).isEqualTo(3);
        assertThat(count("""
                select count(*) from capability_pack_release
                where tenant_id = :tenant and release_id in (
                  '018f0000-0000-7000-8000-00000000c311'::uuid,
                  '018f0000-0000-7000-8000-00000000c312'::uuid,
                  '018f0000-0000-7000-8000-00000000c313'::uuid)
                """)).isEqualTo(3);
        assertThat(count("""
                select count(*) from department_support_assessment
                where tenant_id = :tenant and department_support_assessment_id in (
                  '018f0000-0000-7000-8000-00000000c411'::uuid,
                  '018f0000-0000-7000-8000-00000000c412'::uuid,
                  '018f0000-0000-7000-8000-00000000c413'::uuid,
                  '018f0000-0000-7000-8000-00000000c414'::uuid)
                """)).isEqualTo(4);
    }

    private long fixedConfigurationCount(String configType, String idSuffixPattern) {
        return jdbc.sql("""
                select count(*) from config_item
                where tenant_id = :tenant and config_type = :type
                  and right(config_id::text, 4) ~ :pattern
                """)
                .param("tenant", SyntheticDataImporter.TENANT_ID)
                .param("type", configType)
                .param("pattern", idSuffixPattern)
                .query(Long.class)
                .single();
    }

    private long count(String sql) {
        return jdbc.sql(sql)
                .param("tenant", SyntheticDataImporter.TENANT_ID)
                .query(Long.class)
                .single();
    }
}
