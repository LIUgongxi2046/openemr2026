do $$
begin
  if to_regclass('neonatal_followup_record') is null then
    raise exception 'V142 neonatal_followup_record table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'neonatal_followup_immutable'
  ) then
    raise exception 'V142 neonatal followup immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'neonatal_followup_patient_idx'
  ) then
    raise exception 'V142 neonatal followup index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'neonatal_followup_no_show_check'
  ) then
    raise exception 'V142 neonatal followup no-show constraint missing';
  end if;
end $$;
