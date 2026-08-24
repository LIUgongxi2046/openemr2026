do $$
begin
  if to_regclass('inpatient_consultation') is null then
    raise exception 'V34 inpatient consultation table missing';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'inpatient_consultation_protect') then
    raise exception 'V34 consultation evidence trigger missing';
  end if;
end $$;
