create table research_dataset_request (
  tenant_id uuid not null,
  request_id uuid not null,
  requester_id uuid not null,
  purpose varchar(2000) not null check (length(trim(purpose)) >= 4),
  scope_description varchar(4000) not null check (length(trim(scope_description)) >= 4),
  status varchar(16) not null check (status in ('REQUESTED', 'APPROVED', 'EXPORTED', 'DESTROYED', 'REJECTED')),
  approved_by uuid,
  approved_at timestamptz,
  rejection_reason varchar(1000),
  exported_at timestamptz,
  exported_by uuid,
  export_watermark varchar(256),
  destroyed_at timestamptz,
  destroyed_by uuid,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, request_id),
  foreign key (tenant_id, requester_id) references app_user(tenant_id, user_id),
  foreign key (tenant_id, approved_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, exported_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, destroyed_by) references app_user(tenant_id, user_id),
  check ((status = 'REJECTED') = (rejection_reason is not null)),
  check ((status = 'EXPORTED') = (exported_at is not null)),
  check ((status = 'DESTROYED') = (destroyed_at is not null))
);

create index research_dataset_request_status_idx
  on research_dataset_request (tenant_id, status, created_at desc, request_id desc);

create function prevent_research_dataset_request_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'research dataset request purpose and scope are immutable once requested';
end $$;

create trigger research_dataset_request_immutable
  before update of purpose, scope_description, requester_id on research_dataset_request
  for each row execute function prevent_research_dataset_request_mutation();
