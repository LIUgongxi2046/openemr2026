do $$
begin
  if to_regclass('referral') is null then
    raise exception 'V75 referral table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'referral_immutable'
  ) then
    raise exception 'V75 referral immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'referral_patient_idx'
  ) then
    raise exception 'V75 referral index missing';
  end if;
end $$;
