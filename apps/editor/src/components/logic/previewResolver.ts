import { ReactNode, createContext, createElement, useContext } from 'react';
import { Connection, Edge, Node } from 'reactflow';
import {
  ArithmeticNodeData,
  DummyNodeData,
  ListNodeData,
  LogicEditorNodeData,
  ObjectNodeData,
  PageNodeData,
  ScalarValue,
  StringNodeData
} from '@buildweaver/libs';
import {
  NodePreview,
  evaluateArithmeticPreview,
  evaluateDummyPreview,
  evaluateListPreview,
  evaluateObjectPreview,
  evaluateStringPreview,
  formatScalar
} from './preview';
import { logicLogger } from '../../lib/logger';

export interface ConnectedBinding {
  handleId: string;
  sourceNodeId: string;
  sourceLabel: string;
  edgeId: string;
  value: unknown;
}

export interface PreviewResolver {
  getNodePreview: (nodeId: string) => NodePreview;
  getHandleBinding: (nodeId: string, handleId?: string) => ConnectedBinding | undefined;
  isHandleAvailable: (connection: Partial<Connection>) => boolean;
}

const getNodeLabel = (node: Node<LogicEditorNodeData>): string => {
  if (node.type === 'page') {
    return (node.data as PageNodeData).pageName ?? node.id;
  }
  if ('label' in node.data && typeof node.data.label === 'string') {
    return node.data.label;
  }
  return node.id;
};

const normalizeNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

const ensureArray = (value: unknown): ScalarValue[] | undefined => {
  if (Array.isArray(value)) {
    return value as ScalarValue[];
  }
  return undefined;
};

const ensureObject = (value: unknown): Record<string, ScalarValue> | undefined => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, ScalarValue>;
  }
  return undefined;
};

const UNKNOWN_PREVIEW: NodePreview = {
  state: 'unknown',
  heading: 'No data',
  summary: 'Connect nodes or provide sample values.'
};

const buildIncomingMap = (edges: Edge[]): Map<string, Edge[]> => {
  const map = new Map<string, Edge[]>();
  edges.forEach((edge) => {
    if (!edge.target) {
      return;
    }
    const list = map.get(edge.target) ?? [];
    list.push(edge);
    map.set(edge.target, list);
  });
  return map;
};

const createHandleFinder = (incomingMap: Map<string, Edge[]>) => {
  return (nodeId: string, handleId?: string) => {
    if (!handleId) {
      return undefined;
    }
    const incoming = incomingMap.get(nodeId) ?? [];
    const edge = incoming.find((item) => item.targetHandle === handleId);
    if (!edge) {
      return undefined;
    }
    return edge;
  };
};

const evaluateNodePreview = (
  node: Node<LogicEditorNodeData>,
  getBindingValue: (handleId: string) => ConnectedBinding | undefined
): NodePreview => {
  switch (node.type) {
    case 'dummy':
      return evaluateDummyPreview(node.data as DummyNodeData);
    case 'arithmetic': {
      const data = node.data as ArithmeticNodeData;
      const overrides: Record<string, number | null | undefined> = {};
      data.operands.forEach((operand) => {
        const binding = getBindingValue(`operand-${operand.id}`);
        if (binding) {
          overrides[operand.id] = normalizeNumber(binding.value);
        }
      });
      return evaluateArithmeticPreview(data, overrides);
    }
    case 'string': {
      const data = node.data as StringNodeData;
      const overrides: Record<string, string | undefined> = {};
      data.stringInputs.forEach((input) => {
        const binding = getBindingValue(`string-${input.id}`);
        if (binding && binding.value !== undefined && binding.value !== null) {
          if (typeof binding.value === 'string') {
            overrides[input.id] = binding.value;
          } else if (typeof binding.value === 'number' || typeof binding.value === 'boolean') {
            overrides[input.id] = String(binding.value);
          }
        }
      });
      return evaluateStringPreview(data, overrides);
    }
    case 'list': {
      const data = node.data as ListNodeData;
      const overrides: { primarySample?: ScalarValue[]; secondarySample?: ScalarValue[] } = {};
      const primaryBinding = getBindingValue(`list-${node.id}-primary`);
      const secondaryBinding = getBindingValue(`list-${node.id}-secondary`);
      if (primaryBinding) {
        const arr = ensureArray(primaryBinding.value);
        if (arr) {
          overrides.primarySample = arr;
        }
      }
      if (secondaryBinding) {
        const arr = ensureArray(secondaryBinding.value);
        if (arr) {
          overrides.secondarySample = arr;
        }
      }
      return evaluateListPreview(data, overrides);
    }
    case 'object': {
      const data = node.data as ObjectNodeData;
      const overrides: {
        sourceSample?: Record<string, ScalarValue>;
        patchSample?: Record<string, ScalarValue>;
      } = {};
      const sourceBinding = getBindingValue(`object-${node.id}-source`);
      const patchBinding = getBindingValue(`object-${node.id}-patch`);
      if (sourceBinding) {
        const obj = ensureObject(sourceBinding.value);
        if (obj) {
          overrides.sourceSample = obj;
        }
      }
      if (patchBinding) {
        const obj = ensureObject(patchBinding.value);
        if (obj) {
          overrides.patchSample = obj;
        }
      }
      return evaluateObjectPreview(data, overrides);
    }
    default:
      return UNKNOWN_PREVIEW;
  }
};

export const createPreviewResolver = (
  nodes: Node<LogicEditorNodeData>[],
  edges: Edge[]
): PreviewResolver => {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const incomingMap = buildIncomingMap(edges);
  const bindingCache = new Map<string, ConnectedBinding>();
  const previewCache = new Map<string, NodePreview>();
  const findHandleEdge = createHandleFinder(incomingMap);

  const resolveBinding = (nodeId: string, handleId?: string): ConnectedBinding | undefined => {
    if (!handleId) {
      return undefined;
    }
    const cacheKey = `${nodeId}:${handleId}`;
    if (bindingCache.has(cacheKey)) {
      return bindingCache.get(cacheKey);
    }
    const edge = findHandleEdge(nodeId, handleId);
    if (!edge) {
      return undefined;
    }
    const sourcePreview = resolveNode(edge.source);
    if (!sourcePreview || sourcePreview.value === undefined) {
      return undefined;
    }
    const sourceNode = nodeMap.get(edge.source);
    const binding: ConnectedBinding = {
      handleId,
      sourceNodeId: edge.source,
      edgeId: edge.id,
      sourceLabel: sourceNode ? getNodeLabel(sourceNode) : edge.source,
      value: sourcePreview.value
    };
    bindingCache.set(cacheKey, binding);
    return binding;
  };

  const resolveNode = (nodeId: string, stack: Set<string> = new Set()): NodePreview => {
    if (previewCache.has(nodeId)) {
      return previewCache.get(nodeId)!;
    }
    if (stack.has(nodeId)) {
      logicLogger.error('Cycle detected in preview resolver', { nodeId, stack: Array.from(stack) });
      return {
        state: 'error',
        heading: 'Cycle detected',
        summary: 'Break the loop to preview values.'
      };
    }
    const node = nodeMap.get(nodeId);
    if (!node) {
      return UNKNOWN_PREVIEW;
    }
    stack.add(nodeId);
    const preview = evaluateNodePreview(node, (handleId) => resolveBinding(nodeId, handleId));
    stack.delete(nodeId);
    previewCache.set(nodeId, preview);
    return preview;
  };

  const isHandleAvailable = (connection: Partial<Connection>): boolean => {
    if (!connection.target || !connection.targetHandle) {
      return true;
    }
    return !edges.some(
      (edge) => edge.target === connection.target && edge.targetHandle === connection.targetHandle
    );
  };

  return {
    getNodePreview: resolveNode,
    getHandleBinding: resolveBinding,
    isHandleAvailable
  };
};

const PreviewResolverContext = createContext<PreviewResolver | null>(null);

interface PreviewResolverProviderProps {
  resolver: PreviewResolver;
  children: ReactNode;
}

export const PreviewResolverProvider = ({ resolver, children }: PreviewResolverProviderProps) => {
  return createElement(PreviewResolverContext.Provider, { value: resolver }, children);
};

export const usePreviewResolver = (): PreviewResolver => {
  const resolver = useContext(PreviewResolverContext);
  if (!resolver) {
    throw new Error('PreviewResolverContext is not available. Wrap logic nodes with PreviewResolverProvider.');
  }
  return resolver;
};

export const describeBindingValue = (binding?: ConnectedBinding): string => {
  if (!binding) {
    return 'Not connected';
  }
  return `${binding.sourceLabel}: ${formatScalar(binding.value as ScalarValue | ScalarValue[])}`;
};