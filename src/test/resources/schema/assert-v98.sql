do $$
begin
  if to_regclass('obstetric_delivery_record') is null then
    raise exception 'V98 obstetric_delivery_record table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'obstetric_delivery_immutable'
  ) then
    raise exception 'V98 obstetric delivery immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'obstetric_delivery_patient_idx'
  ) then
    raise exception 'V98 obstetric delivery index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'obstetric_delivery_hemorrhage_check'
  ) then
    raise exception 'V98 obstetric delivery hemorrhage constraint missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'obstetric_delivery_mother_neonate_check'
  ) then
    raise exception 'V98 obstetric delivery mother-neonate constraint missing';
  end if;
end $$;
