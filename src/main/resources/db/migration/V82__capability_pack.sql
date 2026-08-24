create table capability_pack (
  tenant_id uuid not null,
  capability_pack_id uuid not null,
  pack_code varchar(128) not null,
  pack_name varchar(256) not null check (length(trim(pack_name)) >= 2),
  inherits_from varchar(128),
  status varchar(16) not null check (status in ('ACTIVE', 'INACTIVE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, capability_pack_id),
  unique (tenant_id, pack_code),
  check (inherits_from is null or inherits_from <> pack_code),
  foreign key (tenant_id, inherits_from) references capability_pack(tenant_id, pack_code)
);

create index capability_pack_status_idx
  on capability_pack (tenant_id, status, pack_code);

create function prevent_capability_pack_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'capability pack code and inheritance are immutable once defined';
end $$;

create trigger capability_pack_immutable
  before update of pack_code, inherits_from on capability_pack
  for each row execute function prevent_capability_pack_mutation();
