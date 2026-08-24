create table prompt_release (
  tenant_id uuid not null,
  prompt_release_id uuid not null,
  prompt_code varchar(128) not null,
  release_version varchar(64) not null,
  display_name varchar(256) not null check (length(trim(display_name)) >= 2),
  content text not null check (length(trim(content)) >= 8),
  status varchar(16) not null check (status in ('DRAFT', 'ACTIVE', 'RETIRED')),
  effective_from timestamptz not null,
  effective_to timestamptz,
  published_by uuid not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, prompt_release_id),
  unique (tenant_id, prompt_code, release_version),
  check (effective_to is null or effective_to >= effective_from),
  foreign key (tenant_id, published_by) references app_user(tenant_id, user_id)
);

create unique index prompt_release_one_active_idx
  on prompt_release (tenant_id, prompt_code) where status = 'ACTIVE';

create index prompt_release_prompt_idx
  on prompt_release (tenant_id, prompt_code, created_at desc, prompt_release_id desc);

create function prevent_prompt_release_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'prompt release content and identity are immutable once published';
end $$;

create trigger prompt_release_immutable
  before update of content, prompt_code, release_version, published_by, effective_from on prompt_release
  for each row execute function prevent_prompt_release_mutation();
