import type { OrganizationUnitWire } from '../generated/contracts';

export interface OrganizationTreeNode {
  unit: OrganizationUnitWire;
  children: OrganizationTreeNode[];
  activeBedCount: number;
}

const unitOrder: Record<OrganizationUnitWire['unit_type'], number> = {
  ORGANIZATION: 0,
  FACILITY: 1,
  DEPARTMENT: 2,
  WARD: 3,
  BED: 4,
};

function sortUnits(left: OrganizationUnitWire, right: OrganizationUnitWire) {
  return unitOrder[left.unit_type] - unitOrder[right.unit_type]
    || left.display_name.localeCompare(right.display_name, 'zh-CN');
}

export function buildOrganizationTree(units: OrganizationUnitWire[]): OrganizationTreeNode[] {
  const activeUnits = units.filter((unit) => unit.status === 'ACTIVE');
  const visibleUnits = activeUnits.filter((unit) => unit.unit_type !== 'BED');
  const visibleIds = new Set(visibleUnits.map((unit) => unit.unit_id));
  const childrenByParent = new Map<string, OrganizationUnitWire[]>();
  const bedsByWard = new Map<string, number>();

  for (const unit of activeUnits) {
    if (unit.unit_type === 'BED' && unit.parent_unit_id) {
      bedsByWard.set(unit.parent_unit_id, (bedsByWard.get(unit.parent_unit_id) ?? 0) + 1);
      continue;
    }
    const parentId = unit.parent_unit_id && visibleIds.has(unit.parent_unit_id) ? unit.parent_unit_id : 'ROOT';
    const siblings = childrenByParent.get(parentId) ?? [];
    siblings.push(unit);
    childrenByParent.set(parentId, siblings);
  }

  const append = (parentId: string, ancestors: ReadonlySet<string>): OrganizationTreeNode[] =>
    [...(childrenByParent.get(parentId) ?? [])].sort(sortUnits).map((unit) => {
      if (ancestors.has(unit.unit_id)) return { unit, children: [], activeBedCount: bedsByWard.get(unit.unit_id) ?? 0 };
      const nextAncestors = new Set(ancestors);
      nextAncestors.add(unit.unit_id);
      return {
        unit,
        children: append(unit.unit_id, nextAncestors),
        activeBedCount: bedsByWard.get(unit.unit_id) ?? 0,
      };
    });

  return append('ROOT', new Set());
}

export function defaultExpandedOrganizationIds(nodes: OrganizationTreeNode[]): Set<string> {
  return new Set(nodes.filter((node) => node.children.length > 0).map((node) => node.unit.unit_id));
}

export function allExpandableOrganizationIds(nodes: OrganizationTreeNode[]): Set<string> {
  const result = new Set<string>();
  const visit = (items: OrganizationTreeNode[]) => items.forEach((node) => {
    if (node.children.length) result.add(node.unit.unit_id);
    visit(node.children);
  });
  visit(nodes);
  return result;
}

export function toggleOrganizationTreeId(expandedIds: ReadonlySet<string>, unitId: string): Set<string> {
  const next = new Set(expandedIds);
  if (next.has(unitId)) next.delete(unitId);
  else next.add(unitId);
  return next;
}

export function countVisibleOrganizationNodes(nodes: OrganizationTreeNode[], expandedIds: ReadonlySet<string>): number {
  return nodes.reduce((count, node) => count + 1
    + (expandedIds.has(node.unit.unit_id) ? countVisibleOrganizationNodes(node.children, expandedIds) : 0), 0);
}
