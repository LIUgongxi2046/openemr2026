create table dermatology_biologic_followup (
  tenant_id uuid not null,
  followup_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  biologic_name varchar(128) not null check (length(trim(biologic_name)) >= 2),
  followup_date timestamptz not null,
  pasi_score numeric(5,1) not null,
  adverse_event boolean not null default false,
  adverse_event_description varchar(2000),
  recorded_by uuid not null,
  recorded_at timestamptz not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id, followup_id),
  constraint dermatology_biologic_followup_pasi_check check (pasi_score between 0 and 72),
  constraint dermatology_biologic_followup_adverse_check
    check (not adverse_event
           or (adverse_event_description is not null and length(trim(adverse_event_description)) >= 2)),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, recorded_by) references app_user(tenant_id, user_id)
);

create index dermatology_biologic_followup_patient_idx
  on dermatology_biologic_followup (tenant_id, patient_id, followup_date desc, followup_id desc);

create function prevent_dermatology_biologic_followup_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'dermatology biologic followup is immutable once recorded';
end $$;

create trigger dermatology_biologic_followup_immutable
  before update of patient_id, encounter_id, biologic_name, followup_date, pasi_score, adverse_event, adverse_event_description
  on dermatology_biologic_followup
  for each row execute function prevent_dermatology_biologic_followup_mutation();
