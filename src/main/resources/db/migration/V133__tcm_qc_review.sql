create table tcm_qc_review (
  tenant_id uuid not null,
  review_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  reviewed_record_type varchar(24) not null check (reviewed_record_type in ('HERBAL_PRESCRIPTION', 'FOUR_EXAMINATIONS')),
  reviewed_record_id uuid not null,
  review_conclusion varchar(8) not null check (review_conclusion in ('PASS', 'FAIL')),
  defect_description varchar(2000),
  reviewed_by uuid not null,
  reviewed_at timestamptz not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id, review_id),
  constraint tcm_qc_defect_check
    check (review_conclusion = 'PASS' or (defect_description is not null and length(trim(defect_description)) >= 2)),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, reviewed_by) references app_user(tenant_id, user_id)
);

create index tcm_qc_patient_idx
  on tcm_qc_review (tenant_id, patient_id, reviewed_at desc, review_id desc);

create function prevent_tcm_qc_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'tcm QC review is immutable once recorded';
end $$;

create trigger tcm_qc_immutable
  before update of patient_id, encounter_id, reviewed_record_type, reviewed_record_id,
    review_conclusion, defect_description, reviewed_at
  on tcm_qc_review
  for each row execute function prevent_tcm_qc_mutation();
