do $$
declare
  required_trigger text;
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = current_schema() and table_name = 'workforce_person_name_history'
  ) then
    raise exception 'V24 workforce name history missing';
  end if;

  foreach required_trigger in array array[
    'review_actor_snapshot', 'signature_actor_snapshot_immutable', 'review_actor_snapshot_immutable'
  ] loop
    if not exists (select 1 from pg_trigger where tgname = required_trigger) then
      raise exception 'V24 trigger % missing', required_trigger;
    end if;
  end loop;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = current_schema() and table_name = 'app_user'
      and column_name = 'row_version' and is_nullable = 'NO'
  ) then
    raise exception 'V24 account row version missing';
  end if;

  if exists (
    select 1 from workforce_person person
    join app_user account on account.tenant_id = person.tenant_id and account.person_id = person.person_id
    left join workforce_person_name_history history
      on history.tenant_id = person.tenant_id and history.person_id = person.person_id
      and history.valid_until is null
    where history.person_id is null
  ) then
    raise exception 'V24 current workforce name history backfill incomplete';
  end if;
end $$;
