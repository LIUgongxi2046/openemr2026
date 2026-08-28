import { describe, expect, it } from 'vitest';

import { buildWorkflowLayout } from './workflow-layout';

describe('workflow graph layout', () => {
  it('lays out the persisted graph from left to right and retains return paths', () => {
    const nodes = [
      { id: 'start', name: '登记', type: 'START' },
      { id: 'triage', name: '分诊', type: 'TASK' },
      { id: 'sign', name: '签署', type: 'SIGN' },
      { id: 'complete', name: '完成', type: 'END' },
    ];
    const edges = [
      { from: 'start', to: 'triage', condition: '登记完成' },
      { from: 'triage', to: 'sign', condition: '分诊完成' },
      { from: 'sign', to: 'complete', condition: '签名有效' },
      { from: 'triage', to: 'start', condition: '资料不全', compensation: true },
    ];

    const layout = buildWorkflowLayout(nodes, edges);
    const positions = Object.fromEntries(layout.nodes.map((node) => [node.id, node]));

    expect(layout.nodes).toHaveLength(4);
    expect(layout.edges).toHaveLength(4);
    expect(positions.start.x).toBeLessThan(positions.triage.x);
    expect(positions.triage.x).toBeLessThan(positions.sign.x);
    expect(positions.complete.y).toBeGreaterThan(positions.sign.y);
    expect(layout.edges.find((edge) => edge.data.compensation)?.width).toBeGreaterThan(0);
  });

  it('keeps cyclic or incomplete configurations visible for correction', () => {
    const layout = buildWorkflowLayout(
      [{ id: 'a' }, { id: 'b' }, { id: 'orphan' }],
      [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }, { from: 'missing', to: 'a' }],
    );

    expect(new Set(layout.nodes.map((node) => `${node.x}:${node.y}`)).size).toBe(3);
    expect(layout.edges).toHaveLength(2);
    expect(layout.width).toBeGreaterThanOrEqual(640);
    expect(layout.height).toBeGreaterThanOrEqual(520);
  });
});
