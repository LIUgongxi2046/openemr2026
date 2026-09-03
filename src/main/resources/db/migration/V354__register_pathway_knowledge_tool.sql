-- 临床路径知识检索工具（T0 只读，供 Eva 医嘱 Agent 引用已发布路径）。
insert into tool_registry(
  tenant_id, tool_registry_id, tool_code, tool_name, tool_version, tool_type, status)
select organization_tenant.tenant_id, '018f0000-0000-7000-8000-00000000f22c'::uuid,
  'PATHWAY_KNOWLEDGE_SEARCH', '临床路径知识检索', '1.0.0', 'DATABASE_QUERY', 'ACTIVE'
from tenant organization_tenant
on conflict (tenant_id, tool_code, tool_version) do nothing;
