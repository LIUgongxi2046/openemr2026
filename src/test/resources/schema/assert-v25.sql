do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'signature_actor_snapshot_immutable'
      and tgfoid = 'protect_signature_actor_snapshot()'::regprocedure
  ) then
    raise exception 'V25 signature snapshot trigger is not table-specific';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'review_actor_snapshot_immutable'
      and tgfoid = 'protect_review_actor_snapshot()'::regprocedure
  ) then
    raise exception 'V25 review snapshot trigger is not table-specific';
  end if;
  if to_regprocedure('protect_clinical_actor_snapshot()') is not null then
    raise exception 'V25 unsafe shared snapshot trigger function still exists';
  end if;
end $$;
