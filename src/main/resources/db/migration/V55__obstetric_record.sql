create table obstetric_record (
  tenant_id uuid not null,
  obstetric_record_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  gravidity integer not null check (gravidity >= 0),
  parity integer not null check (parity >= 0 and parity <= gravidity),
  gestational_weeks integer not null check (gestational_weeks between 0 and 45),
  estimated_due_date date,
  blood_group varchar(8) not null check (blood_group in ('A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG')),
  rh_factor varchar(8) not null check (rh_factor in ('POSITIVE', 'NEGATIVE')),
  high_risk_factors varchar(2000) not null check (length(trim(high_risk_factors)) >= 2),
  status varchar(16) not null check (status in ('ACTIVE', 'COMPLETED')),
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, obstetric_record_id),
  unique (tenant_id, encounter_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  check (estimated_due_date is null or estimated_due_date > current_date)
);

create index obstetric_record_patient_idx
  on obstetric_record (tenant_id, patient_id, status, created_at desc, obstetric_record_id desc);

create function prevent_obstetric_record_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'obstetric record identity is immutable once created';
end $$;

create trigger obstetric_record_immutable
  before update of patient_id, encounter_id, gravidity, parity, gestational_weeks,
    estimated_due_date, blood_group, rh_factor on obstetric_record
  for each row execute function prevent_obstetric_record_mutation();
