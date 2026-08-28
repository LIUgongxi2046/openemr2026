export interface WorkflowNodeRecord {
  id: string;
  name?: string;
  type?: string;
  owner?: string;
  minutes?: number;
  protected?: boolean;
  terminal?: boolean;
  [key: string]: unknown;
}

export interface WorkflowEdgeRecord {
  from: string;
  to: string;
  condition?: string;
  compensation?: boolean;
  [key: string]: unknown;
}

export interface WorkflowLayoutNode<T extends WorkflowNodeRecord = WorkflowNodeRecord> {
  id: string;
  index: number;
  x: number;
  y: number;
  data: T;
}

export interface WorkflowLayoutEdge<T extends WorkflowEdgeRecord = WorkflowEdgeRecord> {
  index: number;
  from: string;
  to: string;
  x: number;
  y: number;
  width: number;
  angle: number;
  labelX: number;
  labelY: number;
  data: T;
}

export interface WorkflowLayout<TNode extends WorkflowNodeRecord = WorkflowNodeRecord, TEdge extends WorkflowEdgeRecord = WorkflowEdgeRecord> {
  width: number;
  height: number;
  nodes: WorkflowLayoutNode<TNode>[];
  edges: WorkflowLayoutEdge<TEdge>[];
}

const NODE_WIDTH = 154;
const NODE_HEIGHT = 88;
const COLUMN_STEP = 194;
const ROW_STEP = 116;
const CANVAS_PADDING = 32;
const MAX_COLUMNS = 3;

/**
 * Builds a deterministic left-to-right layout from the persisted workflow graph.
 * Compensation paths are excluded from depth calculation so return loops cannot
 * push the graph wider on every render, but they are still drawn and editable.
 */
export function buildWorkflowLayout<TNode extends WorkflowNodeRecord, TEdge extends WorkflowEdgeRecord>(
  sourceNodes: TNode[],
  sourceEdges: TEdge[],
): WorkflowLayout<TNode, TEdge> {
  const idToIndex = new Map(sourceNodes.map((node, index) => [String(node.id), index]));
  const depth = new Map(sourceNodes.map((node) => [String(node.id), 0]));
  const indegree = new Map(sourceNodes.map((node) => [String(node.id), 0]));
  const outgoing = new Map(sourceNodes.map((node) => [String(node.id), [] as string[]]));

  for (const edge of sourceEdges) {
    const from = String(edge.from);
    const to = String(edge.to);
    if (edge.compensation || from === to || !idToIndex.has(from) || !idToIndex.has(to)) continue;
    outgoing.get(from)?.push(to);
    indegree.set(to, (indegree.get(to) ?? 0) + 1);
  }

  const queue = sourceNodes
    .map((node) => String(node.id))
    .filter((id) => (indegree.get(id) ?? 0) === 0);
  const visited = new Set<string>();
  while (queue.length) {
    const from = queue.shift()!;
    visited.add(from);
    for (const to of outgoing.get(from) ?? []) {
      depth.set(to, Math.max(depth.get(to) ?? 0, (depth.get(from) ?? 0) + 1));
      indegree.set(to, (indegree.get(to) ?? 1) - 1);
      if (indegree.get(to) === 0) queue.push(to);
    }
  }

  // Keep malformed/cyclic data visible and editable instead of overlapping it at 0,0.
  let fallbackDepth = Math.max(0, ...depth.values());
  for (const node of sourceNodes) {
    const id = String(node.id);
    if (!visited.has(id) && (indegree.get(id) ?? 0) > 0) depth.set(id, ++fallbackDepth);
  }

  const layers = new Map<number, TNode[]>();
  for (const node of sourceNodes) {
    const layer = depth.get(String(node.id)) ?? 0;
    layers.set(layer, [...(layers.get(layer) ?? []), node]);
  }

  const sortedLayers = [...layers.entries()].sort(([left], [right]) => left - right);
  const blockRows = new Map<number, number>();
  for (const [layer, layerNodes] of sortedLayers) {
    const block = Math.floor(layer / MAX_COLUMNS);
    blockRows.set(block, Math.max(blockRows.get(block) ?? 1, layerNodes.length));
  }
  const blockOffsets = new Map<number, number>();
  let nextBlockOffset = 0;
  for (const block of [...blockRows.keys()].sort((left, right) => left - right)) {
    blockOffsets.set(block, nextBlockOffset);
    nextBlockOffset += (blockRows.get(block) ?? 1) * ROW_STEP + 46;
  }

  const nodes: WorkflowLayoutNode<TNode>[] = [];
  for (const [layer, layerNodes] of sortedLayers) {
    const block = Math.floor(layer / MAX_COLUMNS);
    layerNodes.forEach((node, row) => {
      nodes.push({
        id: String(node.id),
        index: idToIndex.get(String(node.id)) ?? row,
        x: CANVAS_PADDING + (layer % MAX_COLUMNS) * COLUMN_STEP,
        y: CANVAS_PADDING + (blockOffsets.get(block) ?? 0) + row * ROW_STEP,
        data: node,
      });
    });
  }

  const positioned = new Map(nodes.map((node) => [node.id, node]));
  const edges: WorkflowLayoutEdge<TEdge>[] = [];
  sourceEdges.forEach((edge, index) => {
    const fromNode = positioned.get(String(edge.from));
    const toNode = positioned.get(String(edge.to));
    if (!fromNode || !toNode) return;
    const forward = toNode.x > fromNode.x;
    const startX = forward ? fromNode.x + NODE_WIDTH : fromNode.x;
    const startY = fromNode.y + NODE_HEIGHT / 2;
    const endX = forward ? toNode.x : toNode.x + NODE_WIDTH;
    const endY = toNode.y + NODE_HEIGHT / 2;
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    edges.push({
      index,
      from: String(edge.from),
      to: String(edge.to),
      x: startX,
      y: startY,
      width: Math.max(8, Math.hypot(deltaX, deltaY)),
      angle: Math.atan2(deltaY, deltaX) * 180 / Math.PI,
      labelX: startX + deltaX / 2,
      labelY: startY + deltaY / 2,
      data: edge,
    });
  });

  return {
    width: Math.max(640, ...nodes.map((node) => node.x + NODE_WIDTH + CANVAS_PADDING)),
    height: Math.max(520, ...nodes.map((node) => node.y + NODE_HEIGHT + CANVAS_PADDING)),
    nodes,
    edges,
  };
}
