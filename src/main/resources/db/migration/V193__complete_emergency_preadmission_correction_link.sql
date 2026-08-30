-- V191 was finalized while a local development database already contained its earlier form.
-- Keep fresh installs and that incremental database aligned without replaying destructive DDL.
alter table emergency_preadmission
  add column if not exists supersedes_preadmission_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'emergency_preadmission_supersedes_fk'
      and conrelid = 'emergency_preadmission'::regclass
  ) then
    alter table emergency_preadmission
      add constraint emergency_preadmission_supersedes_fk
      foreign key (tenant_id, supersedes_preadmission_id)
        references emergency_preadmission(tenant_id, preadmission_id);
  end if;
end $$;
