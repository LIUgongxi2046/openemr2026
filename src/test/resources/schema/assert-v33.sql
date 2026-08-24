do $$
begin
  if to_regclass('document_correction_case') is null
      or to_regclass('document_signature_revocation') is null
      or to_regclass('document_correction_propagation') is null
      or to_regclass('document_correction_event') is null then
    raise exception 'V33 document correction/revocation tables missing';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'document_signature_revocation_immutable')
      or not exists (select 1 from pg_trigger where tgname = 'document_correction_event_immutable') then
    raise exception 'V33 legal evidence immutability triggers missing';
  end if;
end $$;
