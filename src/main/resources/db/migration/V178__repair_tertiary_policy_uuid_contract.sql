-- PostgreSQL accepts arbitrary 128-bit values as uuid, while the generated
-- OpenAPI client enforces RFC UUID version and variant bits. Earlier tertiary
-- hospital fixtures cast raw MD5 hashes directly and could therefore break
-- the administration snapshot contract. Repair only those deterministic
-- synthetic policy rows and keep their business keys and lifecycle intact.
with repaired as (
  select tenant_id,
         policy_id as old_policy_id,
         overlay(overlay(md5('tertiary-policy:' || policy_code) placing '5' from 13 for 1) placing '8' from 17 for 1)::uuid as new_policy_id
  from authorization_policy
  where policy_code in (
    'NURSING-RECORD-WRITE', 'NURSING-RECORD-REVIEW', 'MEDICATION-DISPENSE',
    'LAB-RESULT-VERIFY', 'IMAGING-RESULT-VERIFY', 'ADMISSION-REGISTER',
    'MEDICAL-RECORDS-ARCHIVE', 'CLINICAL-ADMIN-ORG', 'SECURITY-AUDIT-READ',
    'SYSTEM-CONFIG-PUBLISH', 'RESEARCH-DEIDENTIFIED-READ',
    'RESEARCH-IDENTIFIED-DENY', 'NURSE-PRESCRIBE-DENY',
    'REGISTRAR-CLINICAL-NOTE-DENY'
  )
)
update authorization_policy policy
set policy_id = repaired.new_policy_id
from repaired
where policy.tenant_id = repaired.tenant_id
  and policy.policy_id = repaired.old_policy_id
  and repaired.old_policy_id <> repaired.new_policy_id;
