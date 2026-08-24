do $$
begin
  if to_regclass('pediatric_followup_record') is null then
    raise exception 'V109 pediatric_followup_record table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'pediatric_followup_immutable'
  ) then
    raise exception 'V109 pediatric followup immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'pediatric_followup_patient_idx'
  ) then
    raise exception 'V109 pediatric followup index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'pediatric_followup_no_show_check'
  ) then
    raise exception 'V109 pediatric followup no-show constraint missing';
  end if;
end $$;
