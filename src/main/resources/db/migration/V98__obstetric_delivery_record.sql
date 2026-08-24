create table obstetric_delivery_record (
  tenant_id uuid not null,
  delivery_record_id uuid not null,
  patient_id uuid not null,
  neonate_patient_id uuid,
  delivery_method varchar(16) not null check (delivery_method in ('VAGINAL', 'CESAREAN', 'FORCEPS', 'VACUUM')),
  delivered_at timestamptz not null,
  blood_loss_ml integer not null,
  labor_duration_minutes integer,
  postpartum_hemorrhage boolean not null default false,
  recorded_by uuid not null,
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default now(),
  primary key (tenant_id, delivery_record_id),
  constraint obstetric_delivery_blood_loss_check check (blood_loss_ml >= 0),
  constraint obstetric_delivery_labor_duration_check check (labor_duration_minutes is null or labor_duration_minutes >= 0),
  constraint obstetric_delivery_hemorrhage_check check (not postpartum_hemorrhage or blood_loss_ml >= 500),
  constraint obstetric_delivery_mother_neonate_check check (neonate_patient_id is null or neonate_patient_id <> patient_id),
  foreign key (tenant_id, patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, neonate_patient_id) references patient(tenant_id, patient_id),
  foreign key (tenant_id, recorded_by) references app_user(tenant_id, user_id)
);

create index obstetric_delivery_patient_idx
  on obstetric_delivery_record (tenant_id, patient_id, delivered_at desc, delivery_record_id desc);

create function prevent_obstetric_delivery_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'obstetric delivery record is immutable once recorded';
end $$;

create trigger obstetric_delivery_immutable
  before update of patient_id, neonate_patient_id, delivery_method, delivered_at,
    blood_loss_ml, labor_duration_minutes, postpartum_hemorrhage
  on obstetric_delivery_record
  for each row execute function prevent_obstetric_delivery_mutation();
