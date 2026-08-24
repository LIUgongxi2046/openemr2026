create table inpatient_consultation (
  tenant_id uuid not null,
  consultation_id uuid not null,
  admission_id uuid not null,
  organization_id uuid not null,
  facility_id uuid not null,
  patient_id uuid not null,
  encounter_id uuid not null,
  requested_department varchar(128) not null check (length(trim(requested_department)) between 2 and 128),
  urgency varchar(16) not null check (urgency in ('ROUTINE', 'URGENT', 'EMERGENCY')),
  reason text not null check (length(trim(reason)) between 4 and 1000),
  clinical_question text not null check (length(trim(clinical_question)) between 4 and 2000),
  status varchar(24) not null check (status in ('REQUESTED', 'ACCEPTED', 'REJECTED', 'OPINION_SIGNED', 'COMPLETED', 'CANCELLED')),
  due_at timestamptz not null,
  requested_by uuid not null,
  requested_at timestamptz not null default now(),
  accepted_by uuid,
  accepted_at timestamptz,
  rejection_reason text,
  rejected_by uuid,
  rejected_at timestamptz,
  opinion text,
  recommendation text,
  opinion_signed_by uuid,
  opinion_signed_at timestamptz,
  completed_by uuid,
  completed_at timestamptz,
  row_version bigint not null default 1 check (row_version > 0),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, consultation_id),
  foreign key (tenant_id, admission_id) references inpatient_admission(tenant_id, admission_id),
  foreign key (tenant_id, requested_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, accepted_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, rejected_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, opinion_signed_by) references app_user(tenant_id, user_id),
  foreign key (tenant_id, completed_by) references app_user(tenant_id, user_id),
  check (due_at > requested_at),
  check ((accepted_by is null) = (accepted_at is null)),
  check ((rejected_by is null) = (rejected_at is null)),
  check ((opinion_signed_by is null) = (opinion_signed_at is null)),
  check ((completed_by is null) = (completed_at is null)),
  check ((opinion is null) = (recommendation is null)),
  check ((opinion is null) = (opinion_signed_by is null)),
  check (requested_by is distinct from accepted_by),
  check (status <> 'REJECTED' or (rejection_reason is not null and rejected_by is not null)),
  check (status not in ('OPINION_SIGNED', 'COMPLETED') or opinion_signed_by is not null),
  check (status <> 'COMPLETED' or completed_by is not null)
);

create index inpatient_consultation_admission_idx
  on inpatient_consultation(tenant_id, admission_id, status, due_at);

create index inpatient_consultation_assignee_idx
  on inpatient_consultation(tenant_id, accepted_by, status, due_at)
  where accepted_by is not null;

create or replace function protect_inpatient_consultation()
returns trigger language plpgsql as $protect$
begin
  if tg_op = 'DELETE' then
    raise exception 'inpatient consultation evidence is immutable' using errcode = '23514';
  end if;
  if new.tenant_id <> old.tenant_id
     or new.consultation_id <> old.consultation_id
     or new.admission_id <> old.admission_id
     or new.organization_id <> old.organization_id
     or new.facility_id <> old.facility_id
     or new.patient_id <> old.patient_id
     or new.encounter_id <> old.encounter_id
     or new.requested_department <> old.requested_department
     or new.urgency <> old.urgency
     or new.reason <> old.reason
     or new.clinical_question <> old.clinical_question
     or new.due_at <> old.due_at
     or new.requested_by <> old.requested_by
     or new.requested_at <> old.requested_at then
    raise exception 'inpatient consultation request evidence is immutable' using errcode = '23514';
  end if;
  if old.opinion_signed_at is not null and (
       new.opinion is distinct from old.opinion
       or new.recommendation is distinct from old.recommendation
       or new.opinion_signed_by is distinct from old.opinion_signed_by
       or new.opinion_signed_at is distinct from old.opinion_signed_at) then
    raise exception 'signed consultation opinion is immutable' using errcode = '23514';
  end if;
  return new;
end
$protect$;

create trigger inpatient_consultation_protect
before update or delete on inpatient_consultation
for each row execute function protect_inpatient_consultation();
