do $$
begin
  if to_regclass('mental_health_crisis_handover') is null then
    raise exception 'V99 mental_health_crisis_handover table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'mental_health_crisis_immutable'
  ) then
    raise exception 'V99 mental health crisis handover immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'mental_health_crisis_patient_idx'
  ) then
    raise exception 'V99 mental health crisis handover index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'mental_health_crisis_provider_check'
  ) then
    raise exception 'V99 mental health crisis provider constraint missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'mental_health_crisis_protection_check'
  ) then
    raise exception 'V99 mental health crisis protection constraint missing';
  end if;
end $$;
