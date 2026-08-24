do $$
begin
  if not exists (select 1 from information_schema.tables where table_name = 'medication_catalog_version') then
    raise exception 'V18 medication_catalog_version missing';
  end if;
  if not exists (select 1 from information_schema.tables where table_name = 'patient_allergy') then
    raise exception 'V18 patient_allergy missing';
  end if;
  if not exists (select 1 from information_schema.tables where table_name = 'medication_safety_evaluation') then
    raise exception 'V18 medication_safety_evaluation missing';
  end if;
  if not exists (select 1 from information_schema.columns
      where table_name = 'clinical_order_item' and column_name = 'ingredient_code') then
    raise exception 'V18 medication order snapshot missing';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'medication_safety_finding_immutable') then
    raise exception 'V18 medication safety immutability trigger missing';
  end if;
end $$;

