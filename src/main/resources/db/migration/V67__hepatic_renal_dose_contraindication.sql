alter table medication_catalog_version
  add column renal_contraindication_stage varchar(8),
  add column hepatic_contraindication_class varchar(1);

alter table medication_catalog_version
  add check (renal_contraindication_stage is null or renal_contraindication_stage in ('MODERATE', 'SEVERE')),
  add check (hepatic_contraindication_class is null or hepatic_contraindication_class in ('B', 'C'));

alter table patient
  add column renal_impairment_stage varchar(8),
  add column hepatic_impairment_class varchar(1);

alter table patient
  add check (renal_impairment_stage is null or renal_impairment_stage in ('MILD', 'MODERATE', 'SEVERE')),
  add check (hepatic_impairment_class is null or hepatic_impairment_class in ('A', 'B', 'C'));
