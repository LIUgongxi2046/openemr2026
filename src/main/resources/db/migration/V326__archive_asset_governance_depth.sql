alter table quality_governance_record
  drop constraint if exists quality_governance_record_module_code_check;

alter table quality_governance_record
  add constraint quality_governance_record_module_code_check
  check (module_code in (
    'QUALITY_CENTER','DEPARTMENT_QC','QUALITY_RATING','INFECTION_EVENTS','CREDENTIALS','ARCHIVE_ASSET'));

alter table quality_governance_agent_proposal
  drop constraint if exists quality_governance_agent_proposal_module_code_check;

alter table quality_governance_agent_proposal
  add constraint quality_governance_agent_proposal_module_code_check
  check (module_code in (
    'QUALITY_CENTER','DEPARTMENT_QC','QUALITY_RATING','INFECTION_EVENTS','CREDENTIALS','ARCHIVE_ASSET'));
