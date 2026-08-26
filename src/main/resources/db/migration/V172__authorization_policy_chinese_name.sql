alter table authorization_policy
  add column policy_name varchar(256);

update authorization_policy
set policy_name = case policy_code
  when 'CLINICAL-DOCUMENT-READ' then '临床病历查看权限'
  when 'CLINICAL-DOCUMENT-WRITE' then '临床病历起草权限'
  when 'SYSTEM-ADMIN-WORKFORCE' then '人员与账户管理权限'
  when 'CROSS-DEPARTMENT-EXPORT-DENY' then '禁止跨科室导出临床病历'
  when 'RESEARCH-DATASET-READ' then '科研数据集查看权限'
  else '既有权限策略'
end
where policy_name is null;

alter table authorization_policy
  alter column policy_name set not null;

comment on column authorization_policy.policy_name is '面向管理员显示的中文策略名称；policy_code 保留为系统唯一编码';
