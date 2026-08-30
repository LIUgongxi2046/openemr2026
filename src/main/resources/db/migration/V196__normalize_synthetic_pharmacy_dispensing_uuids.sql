update pharmacy_dispensing dispensing
set dispensing_id = overlay(overlay(md5('tertiary-operational-v1:dispensing:'
    || dispensing.encounter_id || ':' || dispensing.drug_code)
    placing '4' from 13 for 1) placing 'a' from 17 for 1)::uuid
where dispensing.dispensing_id = md5('tertiary-operational-v1:dispensing:'
    || dispensing.encounter_id || ':' || dispensing.drug_code)::uuid
  and not exists (
    select 1 from audit_event evidence
    where evidence.tenant_id = dispensing.tenant_id
      and evidence.resource_type = 'PHARMACY_DISPENSING'
      and evidence.resource_id = dispensing.dispensing_id
  )
  and not exists (
    select 1 from outbox_event evidence
    where evidence.tenant_id = dispensing.tenant_id
      and evidence.aggregate_type = 'PHARMACY_DISPENSING'
      and evidence.aggregate_id = dispensing.dispensing_id
  );

create or replace function guard_pharmacy_dispensing_mutation() returns trigger language plpgsql as $$
begin
  if new.dispensing_id <> old.dispensing_id
     or new.patient_id <> old.patient_id
     or new.encounter_id <> old.encounter_id
     or new.facility_id <> old.facility_id
     or new.dispensed_by <> old.dispensed_by
     or new.prepared_at <> old.prepared_at then
    raise exception 'pharmacy dispensing identity is immutable once created';
  end if;

  if (new.drug_code <> old.drug_code
      or new.batch_number <> old.batch_number
      or new.quantity <> old.quantity
      or new.quantity_unit <> old.quantity_unit)
     and (old.status <> 'PREPARED' or old.voided_at is not null) then
    raise exception 'only an active prepared dispensing can be corrected';
  end if;

  if old.voided_at is not null
     and (new.voided_at is distinct from old.voided_at
       or new.void_reason is distinct from old.void_reason) then
    raise exception 'void evidence is immutable once recorded';
  end if;
  return new;
end $$;

drop trigger pharmacy_dispensing_mutation_guard on pharmacy_dispensing;
create trigger pharmacy_dispensing_mutation_guard
  before update of dispensing_id, patient_id, encounter_id, facility_id, drug_code, batch_number,
    quantity, quantity_unit, dispensed_by, prepared_at, voided_at, void_reason
  on pharmacy_dispensing
  for each row execute function guard_pharmacy_dispensing_mutation();
