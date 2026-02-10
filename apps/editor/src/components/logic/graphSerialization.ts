import { Edge, Node } from 'reactflow';
import type { LogicEditorEdge, LogicEditorNode, LogicEditorNodeData, QueryNodeData } from '@buildweaver/libs';
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
