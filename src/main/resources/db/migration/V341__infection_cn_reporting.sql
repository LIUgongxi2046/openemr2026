alter table infection_monitoring_event
  add column event_category varchar(32) not null default 'HAI_CASE'
    check (event_category in ('HAI_CASE', 'HAI_OUTBREAK', 'NOTIFIABLE_DISEASE')),
  add column onset_at timestamptz,
  add column detected_at timestamptz,
  add column reporting_window_hours integer not null default 24
    check (reporting_window_hours in (2, 24)),
  add column report_deadline_at timestamptz,
  add column external_report_required boolean not null default false,
  add column external_report_state varchar(24) not null default 'NOT_REQUIRED'
    check (external_report_state in ('NOT_REQUIRED', 'PENDING', 'SUBMITTED', 'ACKNOWLEDGED', 'CORRECTED', 'FAILED')),
  add column report_card_no varchar(128),
  add column receipt_no varchar(128),
  add column correction_of varchar(128),
  add column reporting_policy_code varchar(128) not null default 'HOSPITAL_INFECTION_MONITORING_POLICY',
  add constraint infection_event_timeline_ck check (
    onset_at is null or detected_at is null or onset_at <= detected_at),
  add constraint infection_event_deadline_ck check (
    detected_at is null or report_deadline_at = detected_at + make_interval(hours => reporting_window_hours)),
  add constraint infection_event_external_state_ck check (
    (external_report_required and external_report_state <> 'NOT_REQUIRED')
    or (not external_report_required and external_report_state = 'NOT_REQUIRED')),
  add constraint infection_event_receipt_ck check (
    external_report_state not in ('ACKNOWLEDGED', 'CORRECTED') or receipt_no is not null);

update infection_monitoring_event
set detected_at = reported_at,
    report_deadline_at = reported_at + interval '24 hours'
where detected_at is null;

alter table infection_monitoring_event
  alter column detected_at set not null,
  alter column report_deadline_at set not null;

create index infection_event_reporting_queue_idx
  on infection_monitoring_event (
    tenant_id, facility_id, external_report_required, external_report_state,
    report_deadline_at, infection_event_id);

create unique index infection_event_report_card_uq
  on infection_monitoring_event (tenant_id, report_card_no)
  where report_card_no is not null;

