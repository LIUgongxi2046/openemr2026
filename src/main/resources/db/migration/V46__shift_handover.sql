create table shift_handover (
  tenant_id uuid not null,
  handover_id uuid not null,
  ward_id uuid not null,
  facility_id uuid not null,
  shift_from timestamptz not null,
  shift_to timestamptz not null,
  outgoing_user_id uuid not null,
  incoming_user_id uuid not null,
  handover_summary varchar(16000) not null check (length(trim(handover_summary)) >= 4),
  status varchar(16) not null check (status in ('DRAFT', 'COMPLETED')),
  completed_at timestamptz,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, handover_id),
  foreign key (tenant_id, ward_id) references clinical_ward(tenant_id, ward_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id),
  foreign key (tenant_id, outgoing_user_id) references app_user(tenant_id, user_id),
  foreign key (tenant_id, incoming_user_id) references app_user(tenant_id, user_id),
  check (shift_to > shift_from),
  check (outgoing_user_id <> incoming_user_id),
  check ((status = 'COMPLETED') = (completed_at is not null))
);

create index shift_handover_ward_idx
  on shift_handover (tenant_id, ward_id, shift_to desc, handover_id desc);

create function prevent_shift_handover_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'shift handover summary is immutable once created';
end $$;

create trigger shift_handover_immutable
  before update of handover_summary, shift_from, shift_to, outgoing_user_id, incoming_user_id, ward_id on shift_handover
  for each row execute function prevent_shift_handover_mutation();
