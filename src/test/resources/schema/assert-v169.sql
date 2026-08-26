do $$
begin
  if (select count(*) from medical_agent_release where agent_level = 'MAIN' and status = 'ACTIVE') <> 5 then
    raise exception 'V169 must publish exactly five active main agents';
  end if;
  if (select count(*) from medical_agent_release where agent_level = 'CHILD' and status = 'ACTIVE') <> 33 then
    raise exception 'V169 must publish exactly thirty-three active child agents';
  end if;
  if (select count(*) from medical_agent_composition_release where status = 'ACTIVE') <> 5 then
    raise exception 'V169 must publish exactly five active compositions';
  end if;
  if (select count(*) from medical_agent_composition_node) <> 33 then
    raise exception 'V169 must attach every child agent to one composition';
  end if;
  if exists (
    select 1 from medical_agent_composition_node node
    join medical_agent_composition_release composition
      on composition.composition_code = node.composition_code
      and composition.release_version = node.release_version
    join medical_agent_release child
      on child.agent_code = node.child_agent_code
      and child.release_version = node.release_version
    where child.parent_agent_code <> composition.root_agent_code
  ) then
    raise exception 'V169 composition nodes cannot cross main-agent families';
  end if;
end $$;

do $$
begin
  begin
    update medical_agent_release
    set display_name = 'forbidden mutation'
    where agent_code = 'ENCOUNTER_SUMMARIZER' and release_version = '1.0.0';
    raise exception 'medical agent release mutation should have failed';
  exception when raise_exception then
    if sqlerrm = 'medical agent release mutation should have failed' then
      raise;
    end if;
  end;
end $$;
