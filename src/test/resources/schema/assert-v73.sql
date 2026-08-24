do $$
begin
  if to_regclass('surgical_procedure') is null then
    raise exception 'V73 surgical_procedure table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'surgical_procedure_immutable'
  ) then
    raise exception 'V73 surgical procedure immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'surgical_procedure_patient_idx'
  ) then
    raise exception 'V73 surgical procedure index missing';
  end if;
end $$;
