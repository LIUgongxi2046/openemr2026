create table art_cycle_record (
  tenant_id uuid not null,
  cycle_id uuid not null,
  patient_id uuid not null,
  partner_patient_id uuid,
  encounter_id uuid not null,
  facility_id uuid not null,
  cycle_type varchar(32) not null check (cycle_type in ('IVF', 'ICSI', 'IUI', 'FET', 'OTHER')),
  cycle_number integer not null check (cycle_number > 0),
  ethics_consent_date date not null,
  consent_document_id uuid,
  status varchar(16) not null check (status in ('ACTIVE', 'COMPLETED', 'CANCELLED')),
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, cycle_id),
  unique (tenant_id, encounter_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, partner_patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, consent_document_id) references clinical_document(tenant_id, document_id),
  check (ethics_consent_date <= current_date)
);

create index art_cycle_patient_idx
  on art_cycle_record (tenant_id, patient_id, status, created_at desc, cycle_id desc);

create function prevent_art_cycle_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'art cycle record identity is immutable once created';
end $$;

create trigger art_cycle_record_immutable
  before update of patient_id, partner_patient_id, encounter_id, cycle_type, cycle_number,
    ethics_consent_date, consent_document_id on art_cycle_record
  for each row execute function prevent_art_cycle_mutation();
