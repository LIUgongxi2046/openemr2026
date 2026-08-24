create table ophthalmology_preop_verification (
  tenant_id uuid not null,
  verification_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  surgical_eye varchar(2) not null check (surgical_eye in ('OD', 'OS', 'OU')),
  verified_by uuid not null,
  witnessed_by uuid not null,
  verified_at timestamptz not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id, verification_id),
  constraint ophthalmology_preop_provider_check check (verified_by <> witnessed_by),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, verified_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, witnessed_by) references app_user(tenant_id, user_id)
);

create index ophthalmology_preop_patient_idx
  on ophthalmology_preop_verification (tenant_id, patient_id, verified_at desc, verification_id desc);

create function prevent_ophthalmology_preop_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'ophthalmology preop verification is immutable once recorded';
end $$;

create trigger ophthalmology_preop_immutable
  before update of patient_id, encounter_id, surgical_eye, verified_by, witnessed_by, verified_at
  on ophthalmology_preop_verification
  for each row execute function prevent_ophthalmology_preop_mutation();
