do $$
begin
  if to_regclass('medical_record_asset') is null then
    raise exception 'V97 medical_record_asset table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'medical_record_asset_immutable'
  ) then
    raise exception 'V97 medical record asset immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'medical_record_asset_patient_idx'
  ) then
    raise exception 'V97 medical record asset index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'medical_record_asset_content_hash_check'
  ) then
    raise exception 'V97 medical record asset content-hash constraint missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'medical_record_asset_borrowed_check'
  ) then
    raise exception 'V97 medical record asset borrowed-state constraint missing';
  end if;
end $$;
