do $$
begin
  if to_regclass('research_dataset_request') is null then
    raise exception 'V53 research_dataset_request table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'research_dataset_request_immutable'
  ) then
    raise exception 'V53 research dataset request immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'research_dataset_request_status_idx'
  ) then
    raise exception 'V53 research dataset request index missing';
  end if;
end $$;
