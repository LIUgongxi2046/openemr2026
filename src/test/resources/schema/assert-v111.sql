do $$
begin
  if to_regclass('obstetric_antenatal_exam') is null then
    raise exception 'V111 obstetric_antenatal_exam table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'obstetric_antenatal_immutable'
  ) then
    raise exception 'V111 obstetric antenatal immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'obstetric_antenatal_patient_idx'
  ) then
    raise exception 'V111 obstetric antenatal index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'obstetric_antenatal_preeclampsia_check'
  ) then
    raise exception 'V111 obstetric antenatal preeclampsia constraint missing';
  end if;
end $$;
