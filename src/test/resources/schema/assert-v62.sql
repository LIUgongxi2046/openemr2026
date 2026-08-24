do $$
begin
  if to_regclass('ent_record') is null then
    raise exception 'V62 ent_record table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'ent_record_immutable'
  ) then
    raise exception 'V62 ENT record immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'ent_record_patient_idx'
  ) then
    raise exception 'V62 ENT record index missing';
  end if;
end $$;
