create table release_download_event (
  tenant_id uuid not null,
  download_event_id uuid not null,
  channel varchar(32) not null check (channel in ('GITHUB', 'WEBSITE', 'PACKAGE_REGISTRY', 'DOCKER_HUB')),
  source_ip varchar(45),
  user_agent varchar(512),
  fingerprint_hash char(64) not null,
  is_robot boolean not null,
  downloaded_at timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, download_event_id),
  constraint release_download_fingerprint_check check (fingerprint_hash ~ '^[0-9a-f]{64}$')
);

create unique index release_download_valid_dedup_idx
  on release_download_event (tenant_id, channel, fingerprint_hash) where not is_robot;

create index release_download_channel_idx
  on release_download_event (tenant_id, channel, downloaded_at desc, download_event_id desc);
