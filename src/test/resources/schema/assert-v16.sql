do $$
begin
  if not exists (select 1 from information_schema.tables where table_name = 'clinical_diagnosis_version') then
    raise exception 'V16 clinical_diagnosis_version missing';
  end if;
  if not exists (select 1 from pg_indexes where indexname = 'clinical_diagnosis_one_active_primary_idx') then
    raise exception 'V16 active primary uniqueness missing';
  end if;
  if (select count(*) from diagnosis_terminology_entry where terminology_system = 'ICD-10-CN') <> 4 then
    raise exception 'V16 deterministic terminology fixtures missing';
  end if;
end $$;
