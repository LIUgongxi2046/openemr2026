-- Development-only tertiary fixtures once used md5(text)::uuid. PostgreSQL
-- accepts those bit patterns, but OpenAPI format:uuid correctly requires an
-- RFC 4122 version and variant. Remove only the known synthetic tenant's old
-- deterministic rows and short-lived same-day API-test rows. The
-- dev-synthetic importer immediately recreates the tertiary handovers with
-- normalized v5-shaped deterministic identifiers.

drop trigger shift_handover_patient_immutable on shift_handover_patient;

delete from shift_handover_patient patient_item
using shift_handover handover
where patient_item.tenant_id = '018f0000-0000-7000-8000-00000000aa01'::uuid
  and handover.tenant_id = patient_item.tenant_id
  and handover.handover_id = patient_item.handover_id
  and (
    handover.handover_id in (
      select md5('tertiary-operational-v1:handover:' || ordinal)::uuid
      from generate_series(1, 8) ordinal
    )
    or (handover.shift_to - handover.shift_from <= interval '30 minutes'
      and handover.created_at >= current_date)
  );

delete from shift_handover handover
where handover.tenant_id = '018f0000-0000-7000-8000-00000000aa01'::uuid
  and (
    handover.handover_id in (
      select md5('tertiary-operational-v1:handover:' || ordinal)::uuid
      from generate_series(1, 8) ordinal
    )
    or (handover.shift_to - handover.shift_from <= interval '30 minutes'
      and handover.created_at >= current_date)
  );

create trigger shift_handover_patient_immutable
  before update or delete on shift_handover_patient
  for each row execute function prevent_shift_handover_patient_mutation();
