alter table medication_catalog_version
  add column weight_based boolean not null default false,
  add column min_dose_per_kg numeric(18,6),
  add column max_dose_per_kg numeric(18,6);

alter table medication_catalog_version
  add check (weight_based = (min_dose_per_kg is not null and max_dose_per_kg is not null)),
  add check (min_dose_per_kg is null or min_dose_per_kg > 0),
  add check (max_dose_per_kg is null or max_dose_per_kg >= min_dose_per_kg);

alter table patient
  add column weight_kg numeric(6,2);

alter table patient
  add check (weight_kg is null or (weight_kg between 0.5 and 500));
