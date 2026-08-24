drop trigger if exists signature_actor_snapshot_immutable on signature_evidence;
drop trigger if exists review_actor_snapshot_immutable on document_review_decision;
drop function if exists protect_clinical_actor_snapshot();

create function protect_signature_actor_snapshot()
returns trigger
language plpgsql
as $body$
begin
  if (new.signer_person_id, new.signer_display_name)
    is distinct from (old.signer_person_id, old.signer_display_name) then
    raise exception 'signature actor snapshot is immutable' using errcode = '23514';
  end if;
  return new;
end
$body$;

create function protect_review_actor_snapshot()
returns trigger
language plpgsql
as $body$
begin
  if (new.actor_person_id, new.actor_display_name)
    is distinct from (old.actor_person_id, old.actor_display_name) then
    raise exception 'review actor snapshot is immutable' using errcode = '23514';
  end if;
  return new;
end
$body$;

create trigger signature_actor_snapshot_immutable
before update on signature_evidence
for each row execute function protect_signature_actor_snapshot();

create trigger review_actor_snapshot_immutable
before update on document_review_decision
for each row execute function protect_review_actor_snapshot();
