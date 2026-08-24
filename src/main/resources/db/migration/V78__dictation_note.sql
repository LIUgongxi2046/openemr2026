create table dictation_note (
  tenant_id uuid not null,
  dictation_note_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  transcript varchar(16000) not null check (length(trim(transcript)) >= 2),
  status varchar(16) not null check (status in ('DRAFT', 'REVIEWED', 'SIGNED')),
  reviewed_at timestamptz,
  signed_at timestamptz,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, dictation_note_id),
  check ((status in ('REVIEWED', 'SIGNED')) = (reviewed_at is not null)),
  check ((status = 'SIGNED') = (signed_at is not null)),
  check (signed_at is null or signed_at >= reviewed_at),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id)
);

create index dictation_note_patient_idx
  on dictation_note (tenant_id, patient_id, status, created_at desc, dictation_note_id desc);

create function prevent_dictation_note_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'dictation note transcript and identity are immutable once created';
end $$;

create trigger dictation_note_immutable
  before update of patient_id, encounter_id, facility_id, transcript on dictation_note
  for each row execute function prevent_dictation_note_mutation();
