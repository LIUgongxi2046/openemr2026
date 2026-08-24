create table shift_handover_patient (
  tenant_id uuid not null,
  shift_handover_patient_id uuid not null,
  handover_id uuid not null,
  patient_id uuid not null,
  summary varchar(1000) not null check (length(trim(summary)) >= 2),
  risk_flag boolean not null default false,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id, shift_handover_patient_id),
  unique (tenant_id, handover_id, patient_id),
  foreign key (tenant_id, handover_id) references shift_handover(tenant_id, handover_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id)
);

create index shift_handover_patient_handover_idx
  on shift_handover_patient (tenant_id, handover_id, risk_flag desc, created_at desc, shift_handover_patient_id desc);

create function prevent_shift_handover_patient_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'shift handover patient item is immutable once created';
end $$;

create trigger shift_handover_patient_immutable
  before update or delete on shift_handover_patient
  for each row execute function prevent_shift_handover_patient_mutation();
