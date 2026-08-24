do $$
begin
  if to_regclass('tcm_followup_record') is null then
    raise exception 'V145 tcm_followup_record table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'tcm_followup_immutable'
  ) then
    raise exception 'V145 tcm followup immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'tcm_followup_patient_idx'
  ) then
    raise exception 'V145 tcm followup index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'tcm_followup_no_show_check'
  ) then
    raise exception 'V145 tcm followup no-show constraint missing';
  end if;
end $$;
