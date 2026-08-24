do $$
begin
  if to_regclass('pharmacy_dispensing') is null then
    raise exception 'V72 pharmacy_dispensing table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'pharmacy_dispensing_immutable'
  ) then
    raise exception 'V72 pharmacy dispensing immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'pharmacy_dispensing_patient_idx'
  ) then
    raise exception 'V72 pharmacy dispensing index missing';
  end if;
end $$;
