do $$
begin
  if to_regclass('obstetric_postpartum_followup') is null then
    raise exception 'V113 obstetric_postpartum_followup table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'obstetric_postpartum_immutable'
  ) then
    raise exception 'V113 obstetric postpartum immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'obstetric_postpartum_patient_idx'
  ) then
    raise exception 'V113 obstetric postpartum index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'obstetric_postpartum_complication_check'
  ) then
    raise exception 'V113 obstetric postpartum complication constraint missing';
  end if;
end $$;
