-- Agent releases are append-only. Publish a terminology-only release instead
-- of mutating definitions that may already be referenced by historical runs.

insert into medical_agent_release(
  agent_code, release_version, display_name, agent_level, parent_agent_code, stage_code,
  description, display_role, current_action, contribution_label, output_schema,
  autonomy_level, max_steps, max_tool_calls, max_duration_seconds, status, created_at)
select agent_code, '1.0.1', replace(display_name, '协作者', '医助'), agent_level,
       parent_agent_code, stage_code, replace(description, '协作者', '医助'),
       replace(display_role, '协作者', '医助'),
       replace(current_action, '协作者', '医助'),
       replace(contribution_label, '协作者', '医助'), output_schema,
       autonomy_level, max_steps, max_tool_calls, max_duration_seconds, 'INACTIVE', now()
from medical_agent_release
where release_version = '1.0.0'
  and agent_level = 'MAIN';

insert into medical_agent_release(
  agent_code, release_version, display_name, agent_level, parent_agent_code, stage_code,
  description, display_role, current_action, contribution_label, output_schema,
  autonomy_level, max_steps, max_tool_calls, max_duration_seconds, status, created_at)
select agent_code, '1.0.1', replace(display_name, '协作者', '医助'), agent_level,
       parent_agent_code, stage_code, replace(description, '协作者', '医助'),
       replace(display_role, '协作者', '医助'),
       replace(current_action, '协作者', '医助'),
       replace(contribution_label, '协作者', '医助'), output_schema,
       autonomy_level, max_steps, max_tool_calls, max_duration_seconds, 'INACTIVE', now()
from medical_agent_release
where release_version = '1.0.0'
  and agent_level = 'CHILD';

insert into medical_agent_question_example(
  agent_code, release_version, example_order, question_text)
select agent_code, '1.0.1', example_order, question_text
from medical_agent_question_example
where release_version = '1.0.0';

insert into medical_agent_composition_release(
  composition_code, release_version, root_agent_code, max_depth, status, created_at)
select composition_code, '1.0.1', root_agent_code, max_depth, 'INACTIVE', now()
from medical_agent_composition_release
where release_version = '1.0.0';

insert into medical_agent_composition_node(
  composition_code, release_version, child_agent_code, stage_code,
  node_order, critical, parallel_group)
select composition_code, '1.0.1', child_agent_code, stage_code,
       node_order, critical, parallel_group
from medical_agent_composition_node
where release_version = '1.0.0';

update medical_agent_composition_release
set status = 'INACTIVE'
where release_version = '1.0.0'
  and status = 'ACTIVE';

update medical_agent_release
set status = 'INACTIVE'
where release_version = '1.0.0'
  and status = 'ACTIVE';

update medical_agent_release
set status = 'ACTIVE'
where release_version = '1.0.1';

update medical_agent_composition_release
set status = 'ACTIVE'
where release_version = '1.0.1';

update config_item
set display_name = replace(replace(display_name, 'AI医助小南', 'AI医助 Eva'), '协作者', '医助'),
    payload = replace(replace(payload::text, '小南', 'Eva'), '协作者', '医助')::jsonb,
    row_version = row_version + 1,
    updated_at = now()
where display_name like '%小南%'
   or display_name like '%协作者%'
   or payload::text like '%小南%'
   or payload::text like '%协作者%';
