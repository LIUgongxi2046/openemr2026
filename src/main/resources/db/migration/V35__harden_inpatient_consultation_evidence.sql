alter table inpatient_consultation
  add constraint inpatient_consultation_actor_chain_check check (
    (accepted_by is null or accepted_by is distinct from requested_by)
    and (rejected_by is null or rejected_by is distinct from requested_by)
    and (opinion_signed_by is null or opinion_signed_by = accepted_by)
    and (completed_by is null or completed_by = requested_by)
  ),
  add constraint inpatient_consultation_state_evidence_check check (
    (status = 'REQUESTED'
      and accepted_by is null and rejected_by is null and opinion_signed_by is null and completed_by is null)
    or (status = 'ACCEPTED'
      and accepted_by is not null and rejected_by is null and opinion_signed_by is null and completed_by is null)
    or (status = 'REJECTED'
      and accepted_by is null and rejected_by is not null and opinion_signed_by is null and completed_by is null)
    or (status = 'OPINION_SIGNED'
      and accepted_by is not null and rejected_by is null and opinion_signed_by is not null and completed_by is null)
    or (status = 'COMPLETED'
      and accepted_by is not null and rejected_by is null and opinion_signed_by is not null and completed_by is not null)
    or (status = 'CANCELLED'
      and accepted_by is null and rejected_by is null and opinion_signed_by is null and completed_by is null)
  );

create or replace function protect_inpatient_consultation()
returns trigger language plpgsql as $protect$
begin
  if tg_op = 'DELETE' then
    raise exception 'inpatient consultation evidence is immutable' using errcode = '23514';
  end if;
  if new.tenant_id <> old.tenant_id
     or new.consultation_id <> old.consultation_id
     or new.admission_id <> old.admission_id
     or new.organization_id <> old.organization_id
     or new.facility_id <> old.facility_id
     or new.patient_id <> old.patient_id
     or new.encounter_id <> old.encounter_id
     or new.requested_department <> old.requested_department
     or new.urgency <> old.urgency
     or new.reason <> old.reason
     or new.clinical_question <> old.clinical_question
     or new.due_at <> old.due_at
     or new.requested_by <> old.requested_by
     or new.requested_at <> old.requested_at then
    raise exception 'inpatient consultation request evidence is immutable' using errcode = '23514';
  end if;
  if old.accepted_at is not null and (
       new.accepted_by is distinct from old.accepted_by
       or new.accepted_at is distinct from old.accepted_at) then
    raise exception 'consultation acceptance evidence is immutable' using errcode = '23514';
  end if;
  if old.rejected_at is not null and (
       new.rejection_reason is distinct from old.rejection_reason
       or new.rejected_by is distinct from old.rejected_by
       or new.rejected_at is distinct from old.rejected_at) then
    raise exception 'consultation rejection evidence is immutable' using errcode = '23514';
  end if;
  if old.opinion_signed_at is not null and (
       new.opinion is distinct from old.opinion
       or new.recommendation is distinct from old.recommendation
       or new.opinion_signed_by is distinct from old.opinion_signed_by
       or new.opinion_signed_at is distinct from old.opinion_signed_at) then
    raise exception 'signed consultation opinion is immutable' using errcode = '23514';
  end if;
  if old.completed_at is not null and (
       new.completed_by is distinct from old.completed_by
       or new.completed_at is distinct from old.completed_at) then
    raise exception 'consultation completion evidence is immutable' using errcode = '23514';
  end if;
  if new.row_version <> old.row_version + 1 then
    raise exception 'consultation row version must advance exactly once' using errcode = '23514';
  end if;
  if new.status <> old.status and not (
       (old.status = 'REQUESTED' and new.status in ('ACCEPTED', 'REJECTED', 'CANCELLED'))
       or (old.status = 'ACCEPTED' and new.status = 'OPINION_SIGNED')
       or (old.status = 'OPINION_SIGNED' and new.status = 'COMPLETED')) then
    raise exception 'illegal inpatient consultation state transition' using errcode = '23514';
  end if;
  return new;
end
$protect$;
