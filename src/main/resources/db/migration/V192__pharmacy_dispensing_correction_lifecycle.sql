alter table pharmacy_dispensing
  add column voided_at timestamptz,
  add column void_reason varchar(1000),
  add constraint pharmacy_dispensing_void_pair_check
    check ((voided_at is null and void_reason is null)
      or (voided_at is not null and length(trim(void_reason)) between 4 and 1000)),
  add constraint pharmacy_dispensing_void_time_check
    check (voided_at is null or voided_at >= prepared_at);

drop trigger pharmacy_dispensing_immutable on pharmacy_dispensing;
drop function prevent_pharmacy_dispensing_mutation();

create function guard_pharmacy_dispensing_mutation() returns trigger language plpgsql as $$
begin
  if new.patient_id <> old.patient_id
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

create trigger pharmacy_dispensing_mutation_guard
  before update of patient_id, encounter_id, facility_id, drug_code, batch_number,
    quantity, quantity_unit, dispensed_by, prepared_at, voided_at, void_reason
  on pharmacy_dispensing
  for each row execute function guard_pharmacy_dispensing_mutation();

create function prevent_pharmacy_dispensing_delete() returns trigger language plpgsql as $$
begin
  raise exception 'pharmacy dispensing evidence cannot be deleted; use the void workflow';
end $$;

create trigger pharmacy_dispensing_delete_guard
  before delete on pharmacy_dispensing
  for each row execute function prevent_pharmacy_dispensing_delete();

create index pharmacy_dispensing_active_patient_idx
  on pharmacy_dispensing (tenant_id, patient_id, status, prepared_at desc)
  where voided_at is null;
