-- Clinical emergency facts are never physically deleted. A user-facing delete
-- records a reasoned void, keeps the original fact immutable, and frees the
-- encounter for a corrected replacement where the workflow is single-active.

alter table emergency_triage_assessment
  add column voided_at timestamptz,
  add column void_reason varchar(1000),
  add constraint emergency_triage_void_pair_check
    check ((voided_at is null) = (void_reason is null));

alter table emergency_triage_assessment
  drop constraint emergency_triage_assessment_tenant_id_encounter_id_key;

create unique index emergency_triage_one_active_encounter_idx
  on emergency_triage_assessment (tenant_id, encounter_id)
  where status = 'ACTIVE' and voided_at is null;

alter table emergency_observation
  add column voided_at timestamptz,
  add column void_reason varchar(1000),
  add constraint emergency_observation_void_pair_check
    check ((voided_at is null) = (void_reason is null));

alter table emergency_observation
  drop constraint emergency_observation_tenant_id_encounter_id_key;

create unique index emergency_observation_one_current_encounter_idx
  on emergency_observation (tenant_id, encounter_id)
  where voided_at is null;

alter table emergency_resuscitation
  add column voided_at timestamptz,
  add column void_reason varchar(1000),
  add constraint emergency_resuscitation_void_pair_check
    check ((voided_at is null) = (void_reason is null));

alter table emergency_resuscitation
  drop constraint emergency_resuscitation_tenant_id_encounter_id_key;

create unique index emergency_resuscitation_one_current_encounter_idx
  on emergency_resuscitation (tenant_id, encounter_id)
  where voided_at is null;

alter table emergency_nursing_note
  add column voided_at timestamptz,
  add column void_reason varchar(1000),
  add constraint emergency_nursing_note_void_pair_check
    check ((voided_at is null) = (void_reason is null));

create index emergency_nursing_note_current_patient_idx
  on emergency_nursing_note (tenant_id, patient_id, recorded_at desc)
  where voided_at is null;
