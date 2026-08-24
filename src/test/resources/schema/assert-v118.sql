do $$
begin
  if to_regclass('dermatology_biologic_followup') is null then
    raise exception 'V118 dermatology_biologic_followup table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'dermatology_biologic_followup_immutable'
  ) then
    raise exception 'V118 dermatology biologic followup immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'dermatology_biologic_followup_patient_idx'
  ) then
    raise exception 'V118 dermatology biologic followup index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'dermatology_biologic_followup_adverse_check'
  ) then
    raise exception 'V118 dermatology biologic followup adverse constraint missing';
  end if;
end $$;
