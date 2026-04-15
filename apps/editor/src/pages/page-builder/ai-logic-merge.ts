import type { LogicEditorEdge, LogicEditorNode, ProjectGraphSnapshot } from '../../types/api';

export type LogicGraphMergeOutcome = {
  graph: ProjectGraphSnapshot;
  addedNodes: number;
  addedEdges: number;
  remappedNodes: number;
  skippedEdges: number;
};

const createUniqueId = (preferredId: string, existingIds: Set<string>, prefix: string): string => {
  let nextId = preferredId || `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  while (existingIds.has(nextId)) {
    nextId = `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  }
  existingIds.add(nextId);
  return nextId;
};

const getMinCoordinate = (nodes: LogicEditorNode[], key: 'x' | 'y'): number => {
  if (nodes.length === 0) {
    return 0;
  }
  return Math.min(...nodes.map((node) => node.position[key]));
};

const getMaxCoordinate = (nodes: LogicEditorNode[], key: 'x' | 'y'): number => {
  if (nodes.length === 0) {
    return 0;
  }
  return Math.max(...nodes.map((node) => node.position[key]));
};

export const mergeGeneratedLogicIntoGraph = (
  graph: ProjectGraphSnapshot,
  generatedNodes: LogicEditorNode[],
  generatedEdges: LogicEditorEdge[]
): LogicGraphMergeOutcome => {
  const existingNodeIds = new Set(graph.nodes.map((node) => node.id));
  const existingEdgeIds = new Set(graph.edges.map((edge) => edge.id));
  const remappedNodeIds = new Map<string, string>();

  const generatedMinX = getMinCoordinate(generatedNodes, 'x');
  const generatedMinY = getMinCoordinate(generatedNodes, 'y');
  const anchorX = graph.nodes.length > 0 ? getMaxCoordinate(graph.nodes, 'x') + 260 : 120;
  const anchorY = graph.nodes.length > 0 ? getMinCoordinate(graph.nodes, 'y') : 120;

  let remappedNodes = 0;
  const addedNodes = generatedNodes.map((node) => {
    const preferredId = node.id;
    const resolvedId = createUniqueId(preferredId, existingNodeIds, 'ai-node');
    if (resolvedId !== preferredId) {
      remappedNodes += 1;
    }
    remappedNodeIds.set(node.id, resolvedId);

    return {
      ...node,
      id: resolvedId,
      position: {
        x: node.position.x - generatedMinX + anchorX,
        y: node.position.y - generatedMinY + anchorY
      }
    } satisfies LogicEditorNode;
  });

  const mergedNodeIds = new Set([...graph.nodes.map((node) => node.id), ...addedNodes.map((node) => node.id)]);

  let skippedEdges = 0;
  const addedEdges: LogicEditorEdge[] = [];
  generatedEdges.forEach((edge) => {
    const source = remappedNodeIds.get(edge.source) ?? edge.source;
    const target = remappedNodeIds.get(edge.target) ?? edge.target;

    if (!mergedNodeIds.has(source) || !mergedNodeIds.has(target)) {
      skippedEdges += 1;
      return;
    }

    const resolvedEdgeId = createUniqueId(edge.id, existingEdgeIds, 'ai-edge');
    addedEdges.push({
      ...edge,
      id: resolvedEdgeId,
      source,
      target
    });
  });

  const nextGraph: ProjectGraphSnapshot = {
    ...graph,
    nodes: graph.nodes.concat(addedNodes),
    edges: graph.edges.concat(addedEdges)
  };

  return {
    graph: nextGraph,
    addedNodes: addedNodes.length,
    addedEdges: addedEdges.length,
    remappedNodes,
    skippedEdges
  };
};
