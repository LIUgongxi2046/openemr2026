alter table schedule_slot add column doctor_user_id uuid;

alter table schedule_slot add constraint schedule_slot_doctor_fk
  foreign key (tenant_id, doctor_user_id) references app_user(tenant_id, user_id);

drop index schedule_slot_unique_window_idx;
create unique index schedule_slot_unique_window_idx
  on schedule_slot (
    tenant_id, facility_id, department_id, doctor_user_id,
    visit_type, slot_date, start_time, end_time)
  where status <> 'CANCELLED';

alter table inpatient_admission
  add column admission_no varchar(48),
  add column department_id uuid,
  add column admission_source varchar(24),
  add column admission_type varchar(24),
  add column condition_level varchar(24),
  add column admitting_diagnosis_code varchar(64),
  add column admitting_diagnosis_text varchar(1000),
  add column payment_method_code varchar(64),
  add column identity_verification_method varchar(24),
  add column contact_name varchar(128),
  add column contact_relationship varchar(64),
  add column contact_phone varchar(32),
  add column admission_certificate_no varchar(96),
  add column transfer_from varchar(256),
  add column remarks varchar(1000);

update inpatient_admission admission
set admission_no = 'IP-LEGACY-' || substring(replace(admission.admission_id::text, '-', '') from 1 for 12),
    department_id = ward.department_id,
    admission_source = 'OUTPATIENT',
    admission_type = 'ELECTIVE',
    condition_level = 'GENERAL',
    admitting_diagnosis_text = '既有住院记录，待临床补录入院诊断',
    payment_method_code = 'SELF_PAY',
    identity_verification_method = 'OTHER',
    contact_name = '待补录',
    contact_relationship = '其他',
    contact_phone = '00000000'
from clinical_ward ward
where ward.tenant_id = admission.tenant_id and ward.ward_id = admission.ward_id;

alter table inpatient_admission
  alter column admission_no set not null,
  alter column department_id set not null,
  alter column admission_source set not null,
  alter column admission_type set not null,
  alter column condition_level set not null,
  alter column admitting_diagnosis_text set not null,
  alter column payment_method_code set not null,
  alter column identity_verification_method set not null,
  alter column contact_name set not null,
  alter column contact_relationship set not null,
  alter column contact_phone set not null;

alter table inpatient_admission
  add constraint inpatient_admission_no_unique unique (tenant_id, admission_no),
  add constraint inpatient_admission_department_fk foreign key (tenant_id, facility_id, department_id)
    references clinical_department(tenant_id, facility_id, department_id),
  add constraint inpatient_admission_source_check
    check (admission_source in ('OUTPATIENT','EMERGENCY','TRANSFER','OTHER')),
  add constraint inpatient_admission_type_check
    check (admission_type in ('ELECTIVE','URGENT','EMERGENCY')),
  add constraint inpatient_condition_level_check
    check (condition_level in ('GENERAL','SERIOUS','CRITICAL')),
  add constraint inpatient_identity_verification_check
    check (identity_verification_method in ('RESIDENT_ID','MEDICAL_CARD','OTHER'));

