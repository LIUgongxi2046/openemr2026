create table pediatric_treatment_record (
  tenant_id uuid not null,
  note_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  assessment varchar(4000) not null check (length(trim(assessment)) >= 2),
  intervention varchar(4000) not null check (length(trim(intervention)) >= 2),
  risk_flag boolean not null default false,
  recorded_at timestamptz not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, note_id),
  check (not risk_flag or length(trim(assessment)) >= 8),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id)
);

create index pediatric_treatment_patient_idx
  on pediatric_treatment_record (tenant_id, patient_id, risk_flag desc, recorded_at desc, note_id desc);

create function prevent_pediatric_treatment_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'pediatric_treatment_record is immutable once created';
end $$;

create trigger pediatric_treatment_immutable
  before update of patient_id, encounter_id, facility_id, assessment, intervention, risk_flag, recorded_at
  on pediatric_treatment_record
  for each row execute function prevent_pediatric_treatment_mutation();
