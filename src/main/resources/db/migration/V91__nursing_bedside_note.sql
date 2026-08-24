create table nursing_bedside_note (
  tenant_id uuid not null,
  note_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  note_type varchar(32) not null check (note_type in ('VITAL_SIGNS', 'INTAKE_OUTPUT', 'NURSING_NOTE')),
  recorded_at timestamptz not null,
  synced_at timestamptz not null,
  device_id varchar(128) not null check (length(trim(device_id)) >= 2),
  content varchar(4000) not null check (length(trim(content)) >= 2),
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, note_id),
  check (recorded_at <= synced_at),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id)
);

create index nursing_bedside_note_patient_idx
  on nursing_bedside_note (tenant_id, patient_id, recorded_at desc, note_id desc);

create function prevent_nursing_bedside_note_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'nursing bedside note is immutable once synced';
end $$;

create trigger nursing_bedside_note_immutable
  before update of patient_id, encounter_id, facility_id, note_type, recorded_at, synced_at, device_id, content
  on nursing_bedside_note
  for each row execute function prevent_nursing_bedside_note_mutation();
