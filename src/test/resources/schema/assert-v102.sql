do $$
begin
  if to_regclass('art_embryo_transfer_record') is null then
    raise exception 'V102 art_embryo_transfer_record table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'art_embryo_transfer_immutable'
  ) then
    raise exception 'V102 art embryo transfer immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'art_embryo_transfer_patient_idx'
  ) then
    raise exception 'V102 art embryo transfer index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'art_embryo_transfer_count_check'
  ) then
    raise exception 'V102 art embryo transfer count constraint missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'art_embryo_transfer_operator_check'
  ) then
    raise exception 'V102 art embryo transfer operator constraint missing';
  end if;
end $$;
