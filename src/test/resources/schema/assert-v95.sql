do $$
begin
  if to_regclass('research_cohort_snapshot') is null then
    raise exception 'V95 research_cohort_snapshot table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'research_cohort_snapshot_immutable'
  ) then
    raise exception 'V95 research cohort snapshot immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'research_cohort_snapshot_cohort_idx'
  ) then
    raise exception 'V95 research cohort snapshot index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'research_cohort_snapshot_member_count_check'
  ) then
    raise exception 'V95 research cohort snapshot member-count constraint missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'research_cohort_snapshot_criteria_hash_check'
  ) then
    raise exception 'V95 research cohort snapshot criteria-hash constraint missing';
  end if;
end $$;
