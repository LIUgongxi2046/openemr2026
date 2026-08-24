do $$
begin
  if to_regclass('clinical_pathway_definition') is null
      or to_regclass('clinical_pathway_version') is null
      or to_regclass('clinical_pathway_stage') is null
      or to_regclass('clinical_pathway_stage_task') is null
      or to_regclass('inpatient_pathway_instance') is null
      or to_regclass('inpatient_pathway_task') is null
      or to_regclass('inpatient_pathway_variance') is null then
    raise exception 'V36 clinical pathway tables missing';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'inpatient_pathway_instance_protect')
      or not exists (select 1 from pg_trigger where tgname = 'inpatient_pathway_task_protect')
      or not exists (select 1 from pg_trigger where tgname = 'inpatient_pathway_variance_protect') then
    raise exception 'V36 pathway evidence triggers missing';
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname = current_schema()
      and indexname = 'inpatient_pathway_one_active_idx'
  ) then
    raise exception 'V36 one-active-pathway admission guard missing';
  end if;
end $$;
