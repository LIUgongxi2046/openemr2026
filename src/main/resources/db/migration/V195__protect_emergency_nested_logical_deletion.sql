create or replace function prevent_shift_handover_patient_physical_delete()
returns trigger language plpgsql as $$
begin
  raise exception 'shift handover patient items must be logically voided, not physically deleted';
end $$;

create trigger shift_handover_patient_delete_protected
  before delete on shift_handover_patient
  for each row execute function prevent_shift_handover_patient_physical_delete();

create or replace function prevent_emergency_preadmission_physical_delete()
returns trigger language plpgsql as $$
begin
  raise exception 'emergency preadmissions must be logically voided, not physically deleted';
end $$;

create trigger emergency_preadmission_delete_protected
  before delete on emergency_preadmission
  for each row execute function prevent_emergency_preadmission_physical_delete();

create or replace function prevent_encounter_domain_switch_physical_delete()
returns trigger language plpgsql as $$
begin
  raise exception 'encounter domain switches must be logically voided, not physically deleted';
end $$;

create trigger encounter_domain_switch_delete_protected
  before delete on encounter_domain_switch
  for each row execute function prevent_encounter_domain_switch_physical_delete();
