create table dermatology_biologic_screening (
  tenant_id uuid not null,
  screening_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  biologic_name varchar(128) not null check (length(trim(biologic_name)) >= 2),
  tb_screening_result varchar(16) not null check (tb_screening_result in ('NEGATIVE', 'POSITIVE', 'PENDING')),
  hepatitis_screening_result varchar(16) not null check (hepatitis_screening_result in ('NEGATIVE', 'POSITIVE', 'PENDING')),
  cleared_for_biologic boolean not null,
  screened_at timestamptz not null,
  screened_by uuid not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id, screening_id),
  constraint dermatology_biologic_cleared_check
    check (cleared_for_biologic = (tb_screening_result = 'NEGATIVE' and hepatitis_screening_result = 'NEGATIVE')),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, screened_by) references app_user(tenant_id, user_id)
);

create index dermatology_biologic_patient_idx
  on dermatology_biologic_screening (tenant_id, patient_id, screened_at desc, screening_id desc);

create function prevent_dermatology_biologic_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'dermatology biologic screening is immutable once recorded';
end $$;

create trigger dermatology_biologic_immutable
  before update of patient_id, encounter_id, biologic_name, tb_screening_result,
    hepatitis_screening_result, cleared_for_biologic, screened_at
  on dermatology_biologic_screening
  for each row execute function prevent_dermatology_biologic_mutation();
