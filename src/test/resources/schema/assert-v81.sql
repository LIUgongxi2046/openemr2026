do $$
begin
  if to_regclass('research_cohort') is null then
    raise exception 'V81 research_cohort table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'research_cohort_immutable'
  ) then
    raise exception 'V81 research cohort immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'research_cohort_status_idx'
  ) then
    raise exception 'V81 research cohort index missing';
  end if;
end $$;
