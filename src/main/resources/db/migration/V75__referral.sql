create table referral (
  tenant_id uuid not null,
  referral_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  facility_id uuid not null,
  referral_type varchar(16) not null check (referral_type in ('INTERNAL', 'EXTERNAL')),
  target_department varchar(256),
  target_organization varchar(256),
  reason varchar(1000) not null check (length(trim(reason)) >= 2),
  clinical_summary varchar(16000) not null check (length(trim(clinical_summary)) >= 4),
  status varchar(16) not null check (status in ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED')),
  sent_at timestamptz,
  resolved_at timestamptz,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, referral_id),
  check ((referral_type = 'INTERNAL') = (target_department is not null)),
  check ((referral_type = 'EXTERNAL') = (target_organization is not null)),
  check ((status in ('SENT', 'ACCEPTED', 'REJECTED')) = (sent_at is not null)),
  check ((status in ('ACCEPTED', 'REJECTED')) = (resolved_at is not null)),
  check (resolved_at is null or resolved_at >= sent_at),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, encounter_id) references encounter(tenant_id, encounter_id),
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id)
);

create index referral_patient_idx
  on referral (tenant_id, patient_id, status, created_at desc, referral_id desc);

create function prevent_referral_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'referral identity is immutable once created';
end $$;

create trigger referral_immutable
  before update of patient_id, encounter_id, facility_id, referral_type,
    target_department, target_organization, reason, clinical_summary on referral
  for each row execute function prevent_referral_mutation();
