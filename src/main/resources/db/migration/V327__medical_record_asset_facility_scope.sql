alter table medical_record_asset
  add column organization_id uuid,
  add column facility_id uuid;

update medical_record_asset asset
set organization_id = encounter.organization_id,
    facility_id = encounter.facility_id
from encounter
where encounter.tenant_id = asset.tenant_id and encounter.encounter_id = asset.encounter_id;

with tenant_facility as (
  select distinct on (tenant_id) tenant_id, organization_id, facility_id
  from facility
  where status = 'ACTIVE'
  order by tenant_id, facility_code, facility_id
)
update medical_record_asset asset
set organization_id = fallback.organization_id,
    facility_id = fallback.facility_id
from tenant_facility fallback
where fallback.tenant_id = asset.tenant_id and asset.organization_id is null;

alter table medical_record_asset alter column organization_id set not null;
alter table medical_record_asset alter column facility_id set not null;
alter table medical_record_asset add constraint medical_record_asset_organization_fk
  foreign key (tenant_id, organization_id) references organization(tenant_id, organization_id);
alter table medical_record_asset add constraint medical_record_asset_facility_fk
  foreign key (tenant_id, facility_id) references facility(tenant_id, facility_id);
create unique index if not exists facility_tenant_organization_facility_uq
  on facility (tenant_id, organization_id, facility_id);
alter table medical_record_asset add constraint medical_record_asset_facility_organization_fk
  foreign key (tenant_id, organization_id, facility_id)
  references facility(tenant_id, organization_id, facility_id);

create index medical_record_asset_facility_patient_idx
  on medical_record_asset (tenant_id, organization_id, facility_id, patient_id, status, created_at desc);

create function enforce_medical_record_asset_facility_context() returns trigger language plpgsql as $$
declare
  encounter_organization uuid;
  encounter_facility uuid;
begin
  if new.encounter_id is not null then
    select organization_id, facility_id into encounter_organization, encounter_facility
    from encounter
    where tenant_id = new.tenant_id and encounter_id = new.encounter_id and patient_id = new.patient_id;
    if encounter_organization is null or encounter_organization <> new.organization_id
      or encounter_facility <> new.facility_id then
      raise exception 'medical record asset facility does not match encounter context' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

create trigger medical_record_asset_facility_context_enforced
  before insert or update of organization_id, facility_id, encounter_id, patient_id
  on medical_record_asset for each row execute function enforce_medical_record_asset_facility_context();
