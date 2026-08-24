do $$
begin
  if to_regclass('prompt_release') is null then
    raise exception 'V76 prompt_release table missing';
  end if;
  if not exists (
    select 1 from pg_trigger where tgname = 'prompt_release_immutable'
  ) then
    raise exception 'V76 prompt release immutable trigger missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'prompt_release_one_active_idx'
  ) then
    raise exception 'V76 prompt release active index missing';
  end if;
end $$;
