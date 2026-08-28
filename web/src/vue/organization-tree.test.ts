import { describe, expect, it } from 'vitest';
import type { OrganizationUnitWire } from '../generated/contracts';
import {
  allExpandableOrganizationIds,
  buildOrganizationTree,
  countVisibleOrganizationNodes,
  defaultExpandedOrganizationIds,
  toggleOrganizationTreeId,
} from './organization-tree';

function unit(
  id: string,
  type: OrganizationUnitWire['unit_type'],
  name: string,
  parentId: string | null = null,
): OrganizationUnitWire {
  return {
    unit_type: type,
    unit_id: `018f0000-0000-7000-8000-${id.padStart(12, '0')}`,
    parent_unit_id: parentId ? `018f0000-0000-7000-8000-${parentId.padStart(12, '0')}` : null,
    unit_code: `${type}-${id}`,
    display_name: name,
    status: 'ACTIVE',
    effective_from: '2026-01-01T00:00:00Z',
    effective_until: null,
    row_version: 1,
  };
}

const fixtures = [
  unit('1', 'ORGANIZATION', '江城大学附属医院'),
  unit('2', 'FACILITY', '本部院区', '1'),
  unit('3', 'DEPARTMENT', '心血管内科', '2'),
  unit('4', 'WARD', '心血管内科一病区', '3'),
  unit('5', 'BED', '心血管内科一病区-01床', '4'),
  unit('6', 'BED', '心血管内科一病区-02床', '4'),
];

describe('organization tree', () => {
  it('builds the hierarchy and keeps beds as ward summaries instead of expandable rows', () => {
    const tree = buildOrganizationTree(fixtures);
    const ward = tree[0].children[0].children[0].children[0];

    expect(tree).toHaveLength(1);
    expect(ward.unit.unit_type).toBe('WARD');
    expect(ward.children).toEqual([]);
    expect(ward.activeBedCount).toBe(2);
  });

  it('defaults to the organization level and supports immutable expand and collapse state', () => {
    const tree = buildOrganizationTree(fixtures);
    const defaults = defaultExpandedOrganizationIds(tree);
    const organizationId = tree[0].unit.unit_id;
    const facilityId = tree[0].children[0].unit.unit_id;

    expect([...defaults]).toEqual([organizationId]);
    expect(countVisibleOrganizationNodes(tree, defaults)).toBe(2);
    const expanded = toggleOrganizationTreeId(defaults, facilityId);
    expect(defaults.has(facilityId)).toBe(false);
    expect(expanded.has(facilityId)).toBe(true);
    expect(countVisibleOrganizationNodes(tree, expanded)).toBe(3);
    expect(toggleOrganizationTreeId(expanded, facilityId).has(facilityId)).toBe(false);
  });

  it('collects only nodes that have visible child branches for expand all', () => {
    const tree = buildOrganizationTree(fixtures);
    expect(allExpandableOrganizationIds(tree)).toEqual(new Set([
      tree[0].unit.unit_id,
      tree[0].children[0].unit.unit_id,
      tree[0].children[0].children[0].unit.unit_id,
    ]));
  });

  it('renders a reusable accessible tree component with separate toggle and select controls', () => {
    const components = import.meta.glob('./components/AdminOrganizationTree.vue', {
      query: '?raw', import: 'default', eager: true,
    }) as Record<string, string>;
    const source = components['./components/AdminOrganizationTree.vue'];

    expect(source).toContain("role=\"treeitem\"");
    expect(source).toContain(':aria-expanded=');
    expect(source).toContain('class="org-tree-toggle"');
    expect(source).toContain('class="org-tree-select"');
    expect(source).toContain('<AdminOrganizationTree');
  });

  it('wraps the node list in a keyboard-focusable labeled scrolling region', () => {
    const pages = import.meta.glob('./views/OrganizationAdministrationPage.vue', {
      query: '?raw', import: 'default', eager: true,
    }) as Record<string, string>;
    expect(pages['./views/OrganizationAdministrationPage.vue']).toContain('class="org-tree-scroll"');
    expect(pages['./views/OrganizationAdministrationPage.vue']).toContain('aria-label="组织树节点列表"');
    expect(pages['./views/OrganizationAdministrationPage.vue']).toContain('tabindex="0"');
  });
});
