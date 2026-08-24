create table obstetric_care_note (
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

create index obstetric_care_note_patient_idx
  on obstetric_care_note (tenant_id, patient_id, risk_flag desc, recorded_at desc, note_id desc);

create function prevent_obstetric_care_note_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'obgyn care note is immutable once created';
end $$;

create trigger obstetric_care_note_immutable
  before update of patient_id, encounter_id, facility_id, assessment, intervention, risk_flag, recorded_at
  on obstetric_care_note
  for each row execute function prevent_obstetric_care_note_mutation();
