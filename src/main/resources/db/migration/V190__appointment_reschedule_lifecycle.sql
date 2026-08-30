alter table appointment_event
  drop constraint if exists appointment_event_event_type_check;

alter table appointment_event
  add constraint appointment_event_event_type_check check (
    event_type in ('BOOKED', 'RESCHEDULED', 'CANCELLED', 'CHECKED_IN', 'COMPLETED', 'NO_SHOW'));
