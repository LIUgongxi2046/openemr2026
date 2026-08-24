create table neonatal_wristband_verification (
  tenant_id uuid not null,
  verification_id uuid not null,
  patient_id uuid not null,
  mother_patient_id uuid not null,
  wristband_code varchar(64) not null check (length(trim(wristband_code)) >= 2),
  specimen_code varchar(64) not null check (length(trim(specimen_code)) >= 2),
  verified_by uuid not null,
  witnessed_by uuid not null,
  verified_at timestamptz not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id, verification_id),
  constraint neonatal_wristband_provider_check check (verified_by <> witnessed_by),
  constraint neonatal_wristband_mother_check check (mother_patient_id <> patient_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, mother_patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, verified_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, witnessed_by) references app_user(tenant_id, user_id)
);

create index neonatal_wristband_patient_idx
  on neonatal_wristband_verification (tenant_id, patient_id, verified_at desc, verification_id desc);

create function prevent_neonatal_wristband_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'neonatal wristband verification is immutable once recorded';
end $$;

create trigger neonatal_wristband_immutable
  before update of patient_id, mother_patient_id, wristband_code, specimen_code, verified_by, witnessed_by, verified_at
  on neonatal_wristband_verification
  for each row execute function prevent_neonatal_wristband_mutation();
