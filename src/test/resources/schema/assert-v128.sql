do $$
begin
  if to_regclass('clinical_reminder_conversion') is null then
    raise exception 'V128 clinical_reminder_conversion table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'clinical_reminder_conversion_immutable'
  ) then
    raise exception 'V128 clinical reminder conversion immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'clinical_reminder_conversion_unique'
  ) then
    raise exception 'V128 clinical reminder conversion unique constraint missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'clinical_task_source_type_check'
      and pg_get_constraintdef(oid) like '%REMINDER%'
  ) then
    raise exception 'V128 clinical_task source_type REMINDER missing';
  end if;
end $$;
