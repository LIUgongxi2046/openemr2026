create table nursing_discharge_closure (
  tenant_id uuid not null,
  closure_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  closed_by uuid not null,
  closed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (tenant_id, closure_id),
  unique (tenant_id, encounter_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, closed_by) references app_user(tenant_id, user_id)
);

create index nursing_discharge_closure_patient_idx
  on nursing_discharge_closure (tenant_id, patient_id, closed_at desc, closure_id desc);

create function prevent_nursing_discharge_closure_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'nursing discharge closure is immutable once recorded';
end $$;

create trigger nursing_discharge_closure_immutable
  before update or delete on nursing_discharge_closure
  for each row execute function prevent_nursing_discharge_closure_mutation();
