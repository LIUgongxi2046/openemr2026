do $$
begin
  if to_regclass('release_download_event') is null then
    raise exception 'V123 release_download_event table missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'release_download_valid_dedup_idx'
  ) then
    raise exception 'V123 release download valid dedup index missing';
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'release_download_fingerprint_check'
  ) then
    raise exception 'V123 release download fingerprint constraint missing';
  end if;
end $$;
