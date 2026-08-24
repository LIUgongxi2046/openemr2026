import { describe, expect, it } from 'vitest';
import { metricWorkbenches } from './metric-workbenches';

describe('metric workbench catalog', () => {
  it('gives all five metric pages distinct semantics and four registered metrics', () => {
    const definitions = Object.values(metricWorkbenches);
    expect(definitions).toHaveLength(5);
    expect(new Set(definitions.map((item) => item.metricType)).size).toBe(5);
    for (const item of definitions) {
      expect(item.defaultMetrics).toHaveLength(4);
      expect(item.workflow).toHaveLength(4);
      expect(item.links.length).toBeGreaterThanOrEqual(2);
    }
  });
});
