do $$
begin
  if to_regclass('research_cohort_member') is null then
    raise exception 'V127 research_cohort_member table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'research_cohort_member_immutable'
  ) then
    raise exception 'V127 research cohort member immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'research_cohort_member_unique'
  ) then
    raise exception 'V127 research cohort member unique constraint missing';
  end if;
end $$;
