create table dev_user_credential (
  tenant_id uuid not null,
  user_id uuid not null,
  username varchar(128) not null,
  password_hash varchar(100) not null,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, user_id),
  foreign key (tenant_id, user_id) references app_user(tenant_id, user_id),
  check (length(trim(username)) >= 3)
);

create unique index dev_user_credential_username_idx
  on dev_user_credential (lower(username));

create table user_session (
  tenant_id uuid not null,
  session_id uuid not null,
  user_id uuid not null,
  token_hash bytea not null,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null,
  revoked_at timestamptz,
  revoke_reason varchar(64),
  created_at timestamptz not null default now(),
  primary key (tenant_id, session_id),
  unique (token_hash),
  foreign key (tenant_id, user_id) references app_user(tenant_id, user_id),
  check (expires_at > issued_at),
  check ((revoked_at is null) = (revoke_reason is null))
);

create index user_session_active_user_idx
  on user_session (tenant_id, user_id, expires_at desc)
  where revoked_at is null;

