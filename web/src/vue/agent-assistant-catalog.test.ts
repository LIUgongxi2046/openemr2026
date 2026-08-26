import { describe, expect, it } from 'vitest';
import type { AgentRegistryWire } from '../generated/contracts';
import { assistantAgentCatalog, availableAssistantAgents } from './agent-assistant-catalog';

describe('assistant agent catalog', () => {
  it('exposes only active, catalogued agents in product order', () => {
    const registry: AgentRegistryWire[] = [
      { agent_registry_id: '018f0000-0000-7000-8000-00000000ee02', agent_code: 'ORDER_SAFETY', agent_name: '医嘱安全 Agent', agent_version: '1.0.0', status: 'ACTIVE' },
      { agent_registry_id: '018f0000-0000-7000-8000-00000000ee01', agent_code: 'OPD_COPILOT', agent_name: '门诊协同 Agent', agent_version: '1.0.0', status: 'INACTIVE' },
      { agent_registry_id: '018f0000-0000-7000-8000-00000000ee09', agent_code: 'UNKNOWN', agent_name: '未知 Agent', agent_version: '1.0.0', status: 'ACTIVE' },
    ];
    expect(availableAssistantAgents(registry).map((agent) => agent.code)).toEqual(['ORDER_SAFETY']);
  });

  it('defines timing, safety boundary and executable prompts for every agent', () => {
    expect(assistantAgentCatalog).toHaveLength(6);
    for (const agent of assistantAgentCatalog) {
      expect(agent.timing.length).toBeGreaterThan(8);
      expect(agent.boundary.length).toBeGreaterThan(8);
      expect(agent.tasks.length).toBeGreaterThanOrEqual(2);
      expect(agent.tasks.every((task) => task.prompt.length > 20)).toBe(true);
    }
  });
});
