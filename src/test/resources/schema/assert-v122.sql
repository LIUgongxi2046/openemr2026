do $$
begin
  if to_regclass('clinical_task_team_queue') is null then
    raise exception 'V122 clinical_task_team_queue table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'clinical_task_team_queue_immutable'
  ) then
    raise exception 'V122 clinical task team queue immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'clinical_task_team_queue_active_idx'
  ) then
    raise exception 'V122 clinical task team queue active index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'clinical_task_team_queue_claim_check'
  ) then
    raise exception 'V122 clinical task team queue claim constraint missing';
  end if;
end $$;
