do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'inpatient_consultation_actor_chain_check'
  ) or not exists (
    select 1 from pg_constraint where conname = 'inpatient_consultation_state_evidence_check'
  ) then
    raise exception 'V35 consultation actor/state evidence constraints missing';
  end if;
end $$;
