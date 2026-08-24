create table pediatric_growth_record (
  tenant_id uuid not null,
  growth_record_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  height_cm numeric(6,2) not null,
  weight_kg numeric(6,3) not null,
  head_circumference_cm numeric(6,2),
  measured_at timestamptz not null,
  recorded_by uuid not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id, growth_record_id),
  constraint pediatric_growth_height_check check (height_cm between 30 and 220),
  constraint pediatric_growth_weight_check check (weight_kg between 0.5 and 250),
  constraint pediatric_growth_head_check check (head_circumference_cm is null or head_circumference_cm between 20 and 70),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, recorded_by) references app_user(tenant_id, user_id)
);

create index pediatric_growth_patient_idx
  on pediatric_growth_record (tenant_id, patient_id, measured_at desc, growth_record_id desc);

create function prevent_pediatric_growth_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'pediatric growth record is immutable once recorded';
end $$;

create trigger pediatric_growth_immutable
  before update of patient_id, encounter_id, height_cm, weight_kg, head_circumference_cm, measured_at
  on pediatric_growth_record
  for each row execute function prevent_pediatric_growth_mutation();
