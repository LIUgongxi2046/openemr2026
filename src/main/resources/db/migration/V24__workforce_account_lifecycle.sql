alter table app_user
  add column row_version bigint not null default 1 check (row_version > 0),
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now();

create table workforce_person_name_history (
  tenant_id uuid not null,
  person_name_history_id uuid not null,
  person_id uuid not null,
  version_no integer not null check (version_no > 0),
  display_name varchar(256) not null check (length(trim(display_name)) > 0),
  valid_from timestamptz not null,
  valid_until timestamptz,
  change_reason varchar(1000) not null check (length(trim(change_reason)) > 0),
  changed_by uuid not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, person_name_history_id),
  unique (tenant_id, person_id, version_no),
  foreign key (tenant_id, person_id) references workforce_person(tenant_id, person_id),
  foreign key (tenant_id, changed_by) references app_user(tenant_id, user_id),
  check (valid_until is null or valid_until > valid_from)
);

insert into workforce_person_name_history(
  tenant_id, person_name_history_id, person_id, version_no, display_name,
  valid_from, change_reason, changed_by)
select person.tenant_id, person.person_id, person.person_id, 1, person.display_name,
  person.effective_from, 'V24 workforce identity backfill', account.user_id
from workforce_person person
join lateral (
  select user_id from app_user account
  where account.tenant_id = person.tenant_id and account.person_id = person.person_id
  order by account.user_id limit 1
) account on true;

create unique index workforce_person_current_name_uk
  on workforce_person_name_history(tenant_id, person_id) where valid_until is null;

alter table document_review_decision
  add column actor_person_id uuid,
  add column actor_display_name varchar(256);

update document_review_decision decision
set actor_person_id = account.person_id,
  actor_display_name = person.display_name
from app_user account
join workforce_person person
  on person.tenant_id = account.tenant_id and person.person_id = account.person_id
where account.tenant_id = decision.tenant_id and account.user_id = decision.actor_user_id;

alter table document_review_decision
  alter column actor_person_id set not null,
  alter column actor_display_name set not null,
  add constraint document_review_decision_actor_person_fk
    foreign key (tenant_id, actor_person_id) references workforce_person(tenant_id, person_id);

create or replace function populate_review_actor_snapshot()
returns trigger
language plpgsql
as $body$
begin
  if new.actor_person_id is null or new.actor_display_name is null then
    select account.person_id, person.display_name
    into new.actor_person_id, new.actor_display_name
    from app_user account
    join workforce_person person
      on person.tenant_id = account.tenant_id and person.person_id = account.person_id
    where account.tenant_id = new.tenant_id and account.user_id = new.actor_user_id;
  end if;
  if new.actor_person_id is null or new.actor_display_name is null then
    raise exception 'review actor person snapshot is required' using errcode = '23514';
  end if;
  return new;
end
$body$;

create trigger review_actor_snapshot
before insert on document_review_decision
for each row execute function populate_review_actor_snapshot();

create or replace function protect_clinical_actor_snapshot()
returns trigger
language plpgsql
as $body$
begin
  if tg_table_name = 'signature_evidence'
    and (new.signer_person_id, new.signer_display_name)
      is distinct from (old.signer_person_id, old.signer_display_name) then
    raise exception 'signature actor snapshot is immutable' using errcode = '23514';
  end if;
  if tg_table_name = 'document_review_decision'
    and (new.actor_person_id, new.actor_display_name)
      is distinct from (old.actor_person_id, old.actor_display_name) then
    raise exception 'review actor snapshot is immutable' using errcode = '23514';
  end if;
  return new;
end
$body$;

create trigger signature_actor_snapshot_immutable
before update on signature_evidence
for each row execute function protect_clinical_actor_snapshot();

create trigger review_actor_snapshot_immutable
before update on document_review_decision
for each row execute function protect_clinical_actor_snapshot();
