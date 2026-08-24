do $$
begin
  if to_regclass('skill_registry') is null then
    raise exception 'V84 skill_registry table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'skill_registry_immutable'
  ) then
    raise exception 'V84 skill registry immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'skill_registry_status_idx'
  ) then
    raise exception 'V84 skill registry index missing';
  end if;
end $$;
