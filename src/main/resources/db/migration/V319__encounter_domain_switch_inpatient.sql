alter table encounter_domain_switch
  drop constraint encounter_domain_switch_from_domain_check,
  drop constraint encounter_domain_switch_to_domain_check;

alter table encounter_domain_switch
  add constraint encounter_domain_switch_from_domain_check
    check (from_domain in ('OUTPATIENT', 'EMERGENCY', 'INPATIENT')),
  add constraint encounter_domain_switch_to_domain_check
    check (to_domain in ('OUTPATIENT', 'EMERGENCY', 'INPATIENT'));
