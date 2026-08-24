do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = current_schema() and table_name = 'authorization_policy'
      and constraint_name = 'authorization_policy_draft_approval_ck' and constraint_type = 'CHECK'
  ) then
    raise exception 'V27 draft approval lifecycle constraint missing';
  end if;
  if not exists (
    select 1 from information_schema.table_constraints
    where table_schema = current_schema() and table_name = 'authorization_policy'
      and constraint_name = 'authorization_policy_approval_ck' and constraint_type = 'CHECK'
  ) then
    raise exception 'V27 approval lifecycle constraint missing';
  end if;
end $$;
