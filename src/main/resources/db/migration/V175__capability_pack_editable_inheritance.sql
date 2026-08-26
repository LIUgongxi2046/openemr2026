create or replace function prevent_capability_pack_mutation() returns trigger language plpgsql as $$
begin
  if new.pack_code is distinct from old.pack_code then
    raise exception 'capability pack code is immutable once defined';
  end if;
  return new;
end $$;
