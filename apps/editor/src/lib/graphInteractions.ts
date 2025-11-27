import type { Edge, Node, XYPosition } from 'reactflow';

export type NodePosition = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RectBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type LineSegment = {
  start: XYPosition;
  end: XYPosition;
};

const DEFAULT_DIMENSION = 0;

export const buildNodePositionMap = (nodes: Node[]): Record<string, NodePosition> => {
  return nodes.reduce<Record<string, NodePosition>>((acc, node) => {
    const basePosition = node.positionAbsolute ?? node.position;
    acc[node.id] = {
      id: node.id,
      x: basePosition.x,
      y: basePosition.y,
      width: typeof node.width === 'number' ? node.width : DEFAULT_DIMENSION,
      height: typeof node.height === 'number' ? node.height : DEFAULT_DIMENSION
    };
    return acc;
  }, {});
};

export const createRectFromPoints = (start: XYPosition, end: XYPosition): RectBounds | null => {
  if (start.x === end.x && start.y === end.y) {
    return null;
  }
  return {
    minX: Math.min(start.x, end.x),
    maxX: Math.max(start.x, end.x),
    minY: Math.min(start.y, end.y),
    maxY: Math.max(start.y, end.y)
  };
};

const orientation = (a: XYPosition, b: XYPosition, c: XYPosition): number => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

const isOnSegment = (a: XYPosition, b: XYPosition, c: XYPosition): boolean =>
  Math.min(a.x, c.x) <= b.x && b.x <= Math.max(a.x, c.x) && Math.min(a.y, c.y) <= b.y && b.y <= Math.max(a.y, c.y);

const segmentsIntersect = (segmentA: LineSegment, segmentB: LineSegment): boolean => {
  const { start: p1, end: q1 } = segmentA;
  const { start: p2, end: q2 } = segmentB;
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);

  if (o1 === 0 && isOnSegment(p1, p2, q1)) {
    return true;
  }
  if (o2 === 0 && isOnSegment(p1, q2, q1)) {
    return true;
  }
  if (o3 === 0 && isOnSegment(p2, p1, q2)) {
    return true;
  }
  if (o4 === 0 && isOnSegment(p2, q1, q2)) {
    return true;
  }

  return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0);
};

const getNodeCenter = (node: NodePosition): XYPosition => ({
  x: node.x + node.width / 2,
  y: node.y + node.height / 2
});

export const findEdgesIntersectingSegment = (
  edges: Edge[],
  nodePositions: Record<string, NodePosition>,
  segment: LineSegment
): string[] => {
  return edges
    .filter((edge) => Boolean(nodePositions[edge.source]) && Boolean(nodePositions[edge.target]))
    .filter((edge) => {
      const source = nodePositions[edge.source];
      const target = nodePositions[edge.target];
      if (!source || !target) {
        return false;
      }
      const edgeSegment: LineSegment = {
        start: getNodeCenter(source),
        end: getNodeCenter(target)
      };
      return segmentsIntersect(segment, edgeSegment);
    })
    .map((edge) => edge.id);
};

const isRectInside = (outer: RectBounds, inner: RectBounds): boolean =>
  outer.minX <= inner.minX &&
  outer.maxX >= inner.maxX &&
  outer.minY <= inner.minY &&
  outer.maxY >= inner.maxY;

const getNodeBounds = (node: NodePosition): RectBounds => ({
  minX: node.x,
  maxX: node.x + node.width,
  minY: node.y,
  maxY: node.y + node.height
});

export const getNodesWithinRect = (nodes: Node[], rect: RectBounds): Node[] => {
  const positions = buildNodePositionMap(nodes);
  return nodes.filter((node) => {
    const info = positions[node.id];
    if (!info) {
      return false;
    }
    const nodeBounds = getNodeBounds(info);
    return isRectInside(rect, nodeBounds);
  });
};