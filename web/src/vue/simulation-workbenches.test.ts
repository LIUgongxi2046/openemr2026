import { describe, expect, it } from 'vitest';
import workbenchSource from './components/SimulationWorkbenchPage.vue?raw';
import { mockInterfaceSubmenus, simulationWorkbenches } from './simulation-workbenches';

describe('mock interface submenu contract', () => {
  it('registers one overview and all 13 configured workbenches', () => {
    expect(mockInterfaceSubmenus).toHaveLength(14);
    expect(Object.keys(simulationWorkbenches)).toHaveLength(13);
    expect(new Set(mockInterfaceSubmenus.map(([id]) => id)).size).toBe(14);
  });

  it('keeps every workbench actionable and safety documented', () => {
    for (const definition of Object.values(simulationWorkbenches)) {
      expect(definition.steps).toHaveLength(4);
      expect(definition.safeguards.length).toBeGreaterThanOrEqual(3);
      expect(definition.resultFocus.length).toBeGreaterThan(0);
      expect(definition.defaultEntity.trim()).not.toBe('');
      expect(definition.systemType.trim()).not.toBe('');
    }
  });

  it('keeps the scenario result and API documentation panels top-aligned', () => {
    expect(workbenchSource).toContain('.simulation-layout > .admin-panel + .admin-panel { margin-top: 0; }');
  });
});
