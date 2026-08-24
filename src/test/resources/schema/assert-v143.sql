do $$
begin
  if to_regclass('ent_followup_record') is null then
    raise exception 'V143 ent_followup_record table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'ent_followup_immutable'
  ) then
    raise exception 'V143 ent followup immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'ent_followup_patient_idx'
  ) then
    raise exception 'V143 ent followup index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'ent_followup_no_show_check'
  ) then
    raise exception 'V143 ent followup no-show constraint missing';
  end if;
end $$;
