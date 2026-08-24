import { describe, expect, it } from 'vitest';
import { simulationWorkbenches } from './simulation-workbenches';

describe('scenario simulation workbenches', () => {
  it('defines the 13 external dependency pages with complete workflows and safeguards', () => {
    const definitions = Object.values(simulationWorkbenches);
    expect(definitions).toHaveLength(13);
    expect(new Set(definitions.map((item) => item.id)).size).toBe(13);
    for (const item of definitions) {
      expect(item.steps).toHaveLength(4);
      expect(item.safeguards.length).toBeGreaterThanOrEqual(3);
      expect(item.resultFocus.length).toBeGreaterThanOrEqual(2);
      expect(item.defaultEntity).not.toBe('');
    }
  });

  it('covers identity, AI, devices, integrations, archives and clinical execution', () => {
    const types = new Set(Object.values(simulationWorkbenches).map((item) => item.systemType));
    expect(types).toEqual(new Set([
      'IDENTITY', 'DICTATION', 'MODEL', 'DEVICE', 'INTEGRATION_',
      'ARCHIVE_SCAN', 'ARCHIVE_STORAGE', 'PATHOLOGY', 'ANESTHESIA', 'THERAPY',
    ]));
  });
});
