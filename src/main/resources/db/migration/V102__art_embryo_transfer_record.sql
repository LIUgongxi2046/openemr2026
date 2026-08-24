create table art_embryo_transfer_record (
  tenant_id uuid not null,
  embryo_transfer_id uuid not null,
  cycle_id uuid not null,
  patient_id uuid not null,
  embryo_count integer not null,
  transferred_at timestamptz not null,
  operator_id uuid not null,
  verifier_id uuid not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id, embryo_transfer_id),
  constraint art_embryo_transfer_count_check check (embryo_count >= 1),
  constraint art_embryo_transfer_operator_check check (operator_id <> verifier_id),
  foreign key (tenant_id, cycle_id) references art_cycle_record(tenant_id, cycle_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, operator_id) references app_user(tenant_id, user_id),
  foreign key (tenant_id, verifier_id) references app_user(tenant_id, user_id)
);

create index art_embryo_transfer_patient_idx
  on art_embryo_transfer_record (tenant_id, patient_id, transferred_at desc, embryo_transfer_id desc);

create function prevent_art_embryo_transfer_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'art embryo transfer record is immutable once recorded';
end $$;

create trigger art_embryo_transfer_immutable
  before update of cycle_id, patient_id, embryo_count, transferred_at, operator_id, verifier_id
  on art_embryo_transfer_record
  for each row execute function prevent_art_embryo_transfer_mutation();
