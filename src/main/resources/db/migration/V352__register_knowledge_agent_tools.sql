-- 知识中心 Agent 工具注册：知识库混合检索 / 精确查询 / 图谱邻接（T0 只读，受 Tool Gateway 二次鉴权）。
insert into tool_registry(
  tenant_id, tool_registry_id, tool_code, tool_name, tool_version, tool_type, status)
select organization_tenant.tenant_id, seed.id::uuid, seed.code, seed.name,
  '1.0.0', 'DATABASE_QUERY', 'ACTIVE'
from (values
  ('018f0000-0000-7000-8000-00000000f229', 'KNOWLEDGE_SEARCH', '知识库混合检索'),
  ('018f0000-0000-7000-8000-00000000f22a', 'KNOWLEDGE_LOOKUP', '知识精确查询'),
  ('018f0000-0000-7000-8000-00000000f22b', 'KNOWLEDGE_GRAPH', '知识图谱邻接读取')
) as seed(id, code, name)
cross join tenant organization_tenant
on conflict (tenant_id, tool_code, tool_version) do nothing;
