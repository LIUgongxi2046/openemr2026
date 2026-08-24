alter table appointment
  add column encounter_id uuid,
  add constraint appointment_encounter_fk
    foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id);

create index appointment_encounter_idx
  on appointment (tenant_id, encounter_id)
  where encounter_id is not null;
