do $body$
declare
  constraint_to_replace text;
begin
  select constraint_name into constraint_to_replace
  from information_schema.check_constraints
  where constraint_schema = current_schema()
    and check_clause like '%status%PUBLISHED%approved_by%published_at%'
  order by constraint_name
  limit 1;

  if constraint_to_replace is null then
    raise exception 'The V26 authorization policy lifecycle constraint was not found';
  end if;

  execute format('alter table authorization_policy drop constraint %I', constraint_to_replace);
end
$body$;

alter table authorization_policy
  add constraint authorization_policy_draft_approval_ck
    check (status <> 'DRAFT' or (approved_by is null and published_at is null)),
  add constraint authorization_policy_approval_ck
    check (status = 'DRAFT' or (approved_by is not null and published_at is not null));
