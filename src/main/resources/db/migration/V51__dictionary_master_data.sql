create table dictionary_item (
  tenant_id uuid not null,
  dictionary_item_id uuid not null,
  dictionary_code varchar(64) not null,
  item_code varchar(64) not null,
  item_name varchar(256) not null check (length(trim(item_name)) > 0),
  status varchar(16) not null check (status in ('ACTIVE', 'INACTIVE')),
  effective_from date not null,
  effective_to date,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, dictionary_item_id),
  unique (tenant_id, dictionary_code, item_code),
  check (effective_to is null or effective_to >= effective_from)
);

create index dictionary_item_code_idx
  on dictionary_item (tenant_id, dictionary_code, status, effective_from);

create function prevent_dictionary_item_code_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'dictionary item code and name are immutable once created';
end $$;

create trigger dictionary_item_immutable
  before update of dictionary_code, item_code, item_name on dictionary_item
  for each row execute function prevent_dictionary_item_code_mutation();
