import { Edge, Node } from 'reactflow';
import type { LogicEditorEdge, LogicEditorNode, LogicEditorNodeData } from '@buildweaver/libs';

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

export const serializeNodes = (nodes: FlowNode[]): LogicEditorNode[] =>
  nodes.map((node) => ({
    id: node.id,
    type: (node.type as LogicEditorNode['type']) ?? 'dummy',
    position: node.position,
    data: node.data
  }));

export const serializeEdges = (edges: FlowEdge[]): LogicEditorEdge[] =>
  edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? undefined,
    targetHandle: edge.targetHandle ?? undefined
  }));
