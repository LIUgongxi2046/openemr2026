alter table emergency_preadmission
  add column voided_at timestamptz,
  add column void_reason varchar(1000),
  add column supersedes_preadmission_id uuid,
  add constraint emergency_preadmission_void_reason_check
    check ((voided_at is null and void_reason is null)
      or (voided_at is not null and length(trim(void_reason)) >= 4)),
  add constraint emergency_preadmission_supersedes_fk
    foreign key (tenant_id, supersedes_preadmission_id)
      references emergency_preadmission(tenant_id, preadmission_id);

alter table emergency_nursing_note
  add column supersedes_note_id uuid,
  add constraint emergency_nursing_note_supersedes_fk
    foreign key (tenant_id, supersedes_note_id)
      references emergency_nursing_note(tenant_id, note_id);

alter table shift_handover
  add column supersedes_handover_id uuid,
  add constraint shift_handover_supersedes_fk
    foreign key (tenant_id, supersedes_handover_id)
      references shift_handover(tenant_id, handover_id);

alter table emergency_preadmission
  drop constraint emergency_preadmission_tenant_id_temporary_identifier_key;

create unique index emergency_preadmission_active_identifier_unique
  on emergency_preadmission (tenant_id, temporary_identifier)
  where voided_at is null;

alter table encounter_domain_switch
  add column voided_at timestamptz,
  add column void_reason varchar(1000),
  add column supersedes_domain_switch_id uuid,
  add constraint encounter_domain_switch_void_reason_check
    check ((voided_at is null and void_reason is null)
      or (voided_at is not null and length(trim(void_reason)) >= 4)),
  add constraint encounter_domain_switch_supersedes_fk
    foreign key (tenant_id, supersedes_domain_switch_id)
      references encounter_domain_switch(tenant_id, domain_switch_id);

alter table shift_handover_patient
  add column voided_at timestamptz,
  add column void_reason varchar(1000),
  add column supersedes_patient_item_id uuid,
  add constraint shift_handover_patient_void_reason_check
    check ((voided_at is null and void_reason is null)
      or (voided_at is not null and length(trim(void_reason)) >= 4)),
  add constraint shift_handover_patient_supersedes_fk
    foreign key (tenant_id, supersedes_patient_item_id)
      references shift_handover_patient(tenant_id, shift_handover_patient_id);

alter table shift_handover_patient
  drop constraint shift_handover_patient_tenant_id_handover_id_patient_id_key;

create unique index shift_handover_patient_active_unique
  on shift_handover_patient (tenant_id, handover_id, patient_id)
  where voided_at is null;

drop trigger shift_handover_patient_immutable on shift_handover_patient;

create or replace function prevent_shift_handover_patient_content_mutation()
returns trigger language plpgsql as $$
begin
  if old.handover_id is distinct from new.handover_id
     or old.patient_id is distinct from new.patient_id
     or old.summary is distinct from new.summary
     or old.risk_flag is distinct from new.risk_flag then
    raise exception 'shift handover patient clinical content is immutable; create a correction version';
  end if;
  return new;
end $$;

create trigger shift_handover_patient_content_immutable
  before update on shift_handover_patient
  for each row execute function prevent_shift_handover_patient_content_mutation();
