import type { FlowEdge, FlowNode } from '../components/logic/graphSerialization';
import type { UserDefinedFunction } from '../types/api';

export type GraphSnapshot = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  functions: UserDefinedFunction[];
};

const sanitizeNode = (node: FlowNode): FlowNode => {
  const { selected: _selected, dragging: _dragging, positionAbsolute, width, height, ...rest } = node as FlowNode & {
    dragging?: boolean;
    positionAbsolute?: FlowNode['positionAbsolute'];
    width?: FlowNode['width'];
    height?: FlowNode['height'];
  };
  void _selected;
  void _dragging;

  const sanitized: FlowNode = {
    ...rest,
    ...(positionAbsolute ? { positionAbsolute } : {}),
    ...(typeof width === 'number' ? { width } : {}),
    ...(typeof height === 'number' ? { height } : {})
  };
  return sanitized;
};

const sanitizeEdge = (edge: FlowEdge): FlowEdge => {
  const { selected: _selected, ...rest } = edge as FlowEdge & { selected?: boolean };
  void _selected;
  return { ...rest };
};

const sanitizeFunctions = (functions: UserDefinedFunction[]): UserDefinedFunction[] =>
  functions.map((fn) => ({ ...fn }));

export const sanitizeGraphSnapshot = (snapshot: GraphSnapshot): GraphSnapshot => ({
  nodes: snapshot.nodes.map((node) => sanitizeNode(node)),
  edges: snapshot.edges.map((edge) => sanitizeEdge(edge)),
  functions: sanitizeFunctions(snapshot.functions)
});

export const cloneGraphSnapshot = (snapshot: GraphSnapshot): GraphSnapshot =>
  JSON.parse(JSON.stringify(sanitizeGraphSnapshot(snapshot))) as GraphSnapshot;

export const hashGraphSnapshot = (snapshot: GraphSnapshot): string =>
  JSON.stringify(sanitizeGraphSnapshot(snapshot));
