import { Edge, Node } from 'reactflow';
import type { LogicEditorEdge, LogicEditorNode, LogicEditorNodeData, QueryDefinition, QueryNodeData } from '@buildweaver/libs';
import { logicLogger } from '../../lib/logger';

export type FlowNode = Node<LogicEditorNodeData>;
export type FlowEdge = Edge;

export const toFlowNodes = (nodes: LogicEditorNode[]): FlowNode[] =>
  nodes.map((node) => ({
    id: node.id,
    type: node.type,
    data: node.data,
    position: node.position
  }));

export const toFlowEdges = (edges: LogicEditorEdge[]): FlowEdge[] =>
  edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle
  }));

/**
 * Re-hydrates `arguments` on query nodes from the corresponding QueryDefinition.
 *
 * The backend stores arguments on the QueryDefinition, not on individual query
 * node data. When the frontend receives nodes from the backend (after save or
 * initial load), query nodes lack `arguments`, which causes input handles to
 * disappear. This function restores them.
 */
export const rehydrateQueryNodeArguments = (
  nodes: FlowNode[],
  queries: QueryDefinition[]
): FlowNode[] => {
  const queryMap = new Map(queries.map((q) => [q.id, q]));
  let rehydratedCount = 0;
  const result = nodes.map((node) => {
    if (node.type !== 'query') return node;
    const data = node.data as QueryNodeData;
    const queryDef = queryMap.get(data.queryId);
    if (!queryDef) {
      logicLogger.warn('Cannot rehydrate query node — definition not found', {
        nodeId: node.id,
        queryId: data.queryId
      });
      return node;
    }
    const args = queryDef.arguments.map((arg) => ({
      id: arg.id,
      name: arg.name,
      type: arg.type
    }));
    rehydratedCount++;
    return {
      ...node,
      data: { ...data, arguments: args }
    };
  });
  if (rehydratedCount > 0) {
    logicLogger.debug('Rehydrated arguments on query nodes from definitions', {
      rehydratedCount,
      totalNodes: nodes.length
    });
  }
  return result;
};

/**
 * Strips runtime-only properties from node data before sending to the backend.
 * Query nodes carry `arguments` for rendering but the backend stores
 * arguments on the QueryDefinition, so they must not appear on the node DTO.
 */
const sanitizeNodeData = (node: FlowNode): LogicEditorNodeData => {
  if (node.type === 'query') {
    const { arguments: _args, ...rest } = node.data as QueryNodeData;
    if (_args?.length) {
      logicLogger.debug('Stripped arguments from query node before serialization', {
        nodeId: node.id,
        strippedCount: _args.length
      });
    }
    return rest as LogicEditorNodeData;
  }
  return node.data;
};

export const serializeNodes = (nodes: FlowNode[]): LogicEditorNode[] =>
  nodes.map((node) => ({
    id: node.id,
    type: (node.type as LogicEditorNode['type']) ?? 'dummy',
    position: node.position,
    data: sanitizeNodeData(node)
  }));

export const serializeEdges = (edges: FlowEdge[]): LogicEditorEdge[] =>
  edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? undefined,
    targetHandle: edge.targetHandle ?? undefined
  }));
