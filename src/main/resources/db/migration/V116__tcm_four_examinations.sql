create table tcm_four_examinations (
  tenant_id uuid not null,
  exam_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  inspection varchar(2000) not null check (length(trim(inspection)) >= 2),
  auscultation varchar(2000) not null check (length(trim(auscultation)) >= 2),
  inquiry varchar(2000) not null check (length(trim(inquiry)) >= 2),
  palpation varchar(2000) not null check (length(trim(palpation)) >= 2),
  examined_at timestamptz not null,
  recorded_by uuid not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id, exam_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, recorded_by) references app_user(tenant_id, user_id)
);

create index tcm_four_examinations_patient_idx
  on tcm_four_examinations (tenant_id, patient_id, examined_at desc, exam_id desc);

create function prevent_tcm_four_examinations_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'TCM four examinations record is immutable once recorded';
end $$;

create trigger tcm_four_examinations_immutable
  before update of patient_id, encounter_id, inspection, auscultation, inquiry, palpation, examined_at
  on tcm_four_examinations
  for each row execute function prevent_tcm_four_examinations_mutation();
