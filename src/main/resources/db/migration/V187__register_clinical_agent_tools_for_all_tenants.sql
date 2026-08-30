insert into tool_registry(
  tenant_id, tool_registry_id, tool_code, tool_name, tool_version, tool_type, status)
select organization_tenant.tenant_id, seed.id::uuid, seed.code, seed.name,
  '1.0.0', 'DATABASE_QUERY', 'ACTIVE'
from (values
  ('018f0000-0000-7000-8000-00000000f221', 'CLINICAL_DOCUMENT_READ', '当前就诊文书版本读取'),
  ('018f0000-0000-7000-8000-00000000f222', 'CLINICAL_ORDER_READ', '当前就诊医嘱读取'),
  ('018f0000-0000-7000-8000-00000000f223', 'CLINICAL_RESULT_READ', '当前就诊结果读取'),
  ('018f0000-0000-7000-8000-00000000f224', 'CLINICAL_TASK_READ', '当前就诊任务读取'),
  ('018f0000-0000-7000-8000-00000000f225', 'CLINICAL_ATTACHMENT_READ', '当前就诊附件元数据读取')
) as seed(id, code, name)
cross join tenant organization_tenant
on conflict (tenant_id, tool_code, tool_version) do nothing;
