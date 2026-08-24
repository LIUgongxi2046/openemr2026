do $$
begin
  if to_regclass('outpatient_followup') is null then
    raise exception 'V164 outpatient_followup table missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'outpatient_followup_status_check'
  ) then
    raise exception 'V164 outpatient_followup status check missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'outpatient_followup_patient_idx'
  ) then
    raise exception 'V164 outpatient_followup patient index missing';
  end if;
end $$;
