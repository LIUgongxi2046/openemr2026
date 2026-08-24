do $schema_assert$
declare
  required_table text;
begin
  foreach required_table in array array[
    'ai_use_case_policy', 'ai_run', 'ai_proposal', 'ai_run_event', 'ai_tool_invocation'
  ] loop
    if to_regclass(required_table) is null then
      raise exception 'missing AI table: %', required_table;
    end if;
  end loop;
end
$schema_assert$;

insert into ai_use_case_policy(
  tenant_id, use_case_code, enabled, provider_code, model_code,
  model_residency_policy, prompt_version
) values (
  '00000000-0000-7000-8000-000000000001', 'DOCUMENT_DRAFT_ASSIST', false,
  'NONE', 'NONE', 'ON_PREM_ONLY', 'v1'
);
