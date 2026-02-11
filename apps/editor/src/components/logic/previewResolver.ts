import { ReactNode, createContext, createElement, useContext } from 'react';
import { Connection, Edge, Node } from 'reactflow';
import {
  ArithmeticNodeData,
  ConditionalNodeData,
  DatabaseSchema,
  DummyNodeData,
  FunctionArgumentNodeData,
  FunctionNodeData,
  FunctionReturnNodeData,
  FunctionReferenceValue,
  ListNodeData,
  LogicEditorNodeData,
  LogicalOperatorNodeData,
  ObjectNodeData,
  PageNodeData,
  QueryDefinition,
  QueryMode,
  QueryNodeData,
  RelationalOperatorNodeData,
  ScalarValue,
  StringNodeData,
  UserDefinedFunction
} from '@buildweaver/libs';
import {
  NodePreview,
  evaluateConditionalPreview,
  evaluateArithmeticPreview,
  evaluateDummyPreview,
  evaluateLogicalOperatorPreview,
  evaluateListPreview,
  evaluateObjectPreview,
  evaluateRelationalPreview,
  evaluateStringPreview,
  formatScalar,
  ListCallbackInvocation,
  ListInputOverrides
} from './preview';
import type { ObjectInputOverrides } from './preview';
import { logicLogger } from '../../lib/logger';
import { getListHandleId, normalizeSortOrderValue } from './listOperationConfig';
import { getObjectHandleId, getObjectOperationInputs, ObjectInputRole } from './objectOperationConfig';
import { getConditionalHandleId } from './conditionalHandles';
import { getLogicalHandleId, getLogicalOperationConfig } from './logicalOperatorConfig';
import { getRelationalHandleId } from './relationalOperatorConfig';
import { toFlowEdges, toFlowNodes } from './graphSerialization';
import { evaluateQueryNodePreview, assembleFullSql, inferFullDataShape } from './query/queryPreview';

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
  if (node.type === 'function') {
    return (node.data as FunctionNodeData).functionName ?? node.id;
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

const normalizeBoolean = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    if (Number.isNaN(value)) {
      return null;
    }
    return value !== 0;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
  }
  return null;
};

const isScalarValue = (value: unknown): value is ScalarValue => {
  if (value === null) {
    return true;
  }
  const type = typeof value;
  if (type === 'string' || type === 'number' || type === 'boolean') {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every((entry) => isScalarValue(entry));
  }
  if (value && type === 'object') {
    return Object.values(value as Record<string, unknown>).every((entry) => isScalarValue(entry));
  }
  return false;
};

const ensureArray = (value: unknown): ScalarValue[] | undefined => {
  if (Array.isArray(value) && value.every((entry) => isScalarValue(entry))) {
    return value as ScalarValue[];
  }
  return undefined;
};

const ensureObject = (value: unknown): Record<string, ScalarValue> | undefined => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.every(([, entry]) => isScalarValue(entry))) {
      return value as Record<string, ScalarValue>;
    }
  }
  return undefined;
};

const ensureScalar = (value: unknown): ScalarValue | undefined => {
  if (isScalarValue(value)) {
    return value as ScalarValue;
  }
  return undefined;
};

const isFunctionReferenceValue = (value: unknown): value is FunctionReferenceValue => {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as { kind?: string }).kind === 'function-reference' &&
      typeof (value as { functionId?: unknown }).functionId === 'string'
  );
};

const buildFunctionReferenceValue = (
  data: FunctionNodeData,
  definition?: UserDefinedFunction
): FunctionReferenceValue => ({
  kind: 'function-reference',
  functionId: data.functionId,
  functionName: data.functionName,
  argumentTypes: definition?.arguments?.map((argument) => argument.type),
  returnsValue: definition?.returnsValue ?? data.returnsValue
});

const invokeFunctionReference = (
  invocation: ListCallbackInvocation,
  context: ResolverContext,
  sourceNodeId: string
): ScalarValue | undefined => {
  const definition = context.functionsById?.get(invocation.reference.functionId);
  if (!definition) {
    logicLogger.error('Referenced function missing for callback', {
      nodeId: sourceNodeId,
      functionId: invocation.reference.functionId,
      phase: invocation.metadata.phase
    });
    return undefined;
  }
  const argumentValues: Record<string, ScalarValue | undefined> = {};
  definition.arguments?.forEach((argument, index) => {
    argumentValues[argument.id] = invocation.args[index] as ScalarValue | undefined;
  });
  logicLogger.debug('Executing function reference callback', {
    nodeId: sourceNodeId,
    functionId: invocation.reference.functionId,
    phase: invocation.metadata.phase,
    index: invocation.metadata.index
  });
  return evaluateFunctionReturnValue(definition, context, argumentValues);
};

const normalizeKeysInput = (value: unknown): string[] | undefined => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry ?? ''))
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/\r?\n|,/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return undefined;
};

const normalizePathInput = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized || undefined;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return undefined;
};

const UNKNOWN_PREVIEW: NodePreview = {
  state: 'unknown',
  heading: 'No data',
  summary: 'Connect nodes or provide sample values.'
};

const evaluateFunctionReturnValue = (
  definition: UserDefinedFunction,
  context: ResolverContext,
  argumentValues: Record<string, ScalarValue | undefined>
): ScalarValue | undefined => {
  const flowNodes = toFlowNodes(definition.nodes);
  const flowEdges = toFlowEdges(definition.edges);
  const resolver = createPreviewResolver(flowNodes, flowEdges, {
    functionsById: context.functionsById,
    argumentValueOverrides: argumentValues,
    callStack: context.callStack.concat(definition.id)
  });
  const returnNode = definition.nodes.find((node) => node.type === 'function-return');
  if (!returnNode) {
    logicLogger.warn('Function evaluation skipped due to missing return node', { functionId: definition.id });
    return undefined;
  }
  const data = returnNode.data as FunctionReturnNodeData;
  const binding = resolver.getHandleBinding(returnNode.id, `function-return-${data.returnId}`);
  return binding?.value as ScalarValue | undefined;
};

interface PreviewResolverOptions {
  functions?: UserDefinedFunction[];
  functionsById?: Map<string, UserDefinedFunction>;
  argumentValueOverrides?: Record<string, ScalarValue | undefined>;
  callStack?: string[];
  querySchema?: DatabaseSchema | null;
  queryMode?: QueryMode;
  queryDefinitions?: QueryDefinition[];
  databases?: DatabaseSchema[];
}

interface ResolverContext {
  functionsById?: Map<string, UserDefinedFunction>;
  argumentValueOverrides?: Record<string, ScalarValue | undefined>;
  callStack: string[];
  querySchema?: DatabaseSchema | null;
  queryMode?: QueryMode;
  allNodes: Node<LogicEditorNodeData>[];
  allEdges: Edge[];
  queryDefinitions?: QueryDefinition[];
  databases?: DatabaseSchema[];
}

const getArgumentSample = (type: FunctionArgumentNodeData['type']): ScalarValue => {
  switch (type) {
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'list':
      return [];
    case 'object':
      return {};
    default:
      return '';
  }
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
  getBindingValue: (handleId: string) => ConnectedBinding | undefined,
  context: ResolverContext
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
    case 'conditional': {
      const data = node.data as ConditionalNodeData;
      const overrides: {
        condition?: boolean;
        truthy?: ScalarValue;
        falsy?: ScalarValue;
      } = {};
      const conditionBinding = getBindingValue(getConditionalHandleId(node.id, 'condition'));
      if (conditionBinding) {
        const normalized = normalizeBoolean(conditionBinding.value);
        if (normalized === null) {
          logicLogger.warn('Invalid conditional condition binding ignored', {
            nodeId: node.id,
            handleId: conditionBinding.handleId,
            value: conditionBinding.value
          });
        } else {
          overrides.condition = normalized;
        }
      }
      const truthyBinding = getBindingValue(getConditionalHandleId(node.id, 'truthy'));
      if (truthyBinding) {
        const scalar = ensureScalar(truthyBinding.value);
        if (scalar === undefined) {
          logicLogger.warn('Invalid truthy binding ignored', {
            nodeId: node.id,
            handleId: truthyBinding.handleId
          });
        } else {
          overrides.truthy = scalar;
        }
      }
      const falsyBinding = getBindingValue(getConditionalHandleId(node.id, 'falsy'));
      if (falsyBinding) {
        const scalar = ensureScalar(falsyBinding.value);
        if (scalar === undefined) {
          logicLogger.warn('Invalid falsy binding ignored', {
            nodeId: node.id,
            handleId: falsyBinding.handleId
          });
        } else {
          overrides.falsy = scalar;
        }
      }
      return evaluateConditionalPreview(data, overrides);
    }
    case 'string': {
      const data = node.data as StringNodeData;
      const overrides: Record<string, string | undefined> = {};
      data.stringInputs.forEach((input) => {
        const binding = getBindingValue(`string-${input.id}`);
        if (!binding) {
          return;
        }
        const scalar = ensureScalar(binding.value);
        if (scalar === undefined) {
          logicLogger.warn('Invalid string input binding ignored', {
            nodeId: node.id,
            handleId: binding.handleId,
            value: binding.value
          });
          return;
        }
        overrides[input.id] = String(scalar);
      });
      return evaluateStringPreview(data, overrides);
    }
    case 'function': {
      const data = node.data as FunctionNodeData;
      const definition = context.functionsById?.get(data.functionId);
      let computedValue: ScalarValue | undefined;
      if (data.mode === 'reference') {
        computedValue = buildFunctionReferenceValue(data, definition) as unknown as ScalarValue;
        logicLogger.debug('Function node outputting reference', {
          nodeId: node.id,
          functionId: data.functionId
        });
      } else if (definition && data.mode === 'applied') {
        if (context.callStack.includes(data.functionId)) {
          logicLogger.error('Function preview recursion detected', {
            functionId: data.functionId,
            stack: context.callStack
          });
        } else {
          const argumentValues: Record<string, ScalarValue | undefined> = {};
          definition.arguments?.forEach((argument) => {
            const binding = getBindingValue(`arg-${argument.id}`);
            if (binding) {
              argumentValues[argument.id] = binding.value as ScalarValue | undefined;
            }
          });
          computedValue = evaluateFunctionReturnValue(definition, context, argumentValues);
          logicLogger.debug('Function preview evaluated', {
            functionId: data.functionId,
            inputs: Object.keys(argumentValues).length,
            result: computedValue
          });
        }
      }
      const emitsValue = data.mode === 'applied' && (data.returnsValue ?? definition?.returnsValue ?? true);
      const heading = data.functionName ?? 'Function';
      return {
        state: 'ready',
        heading,
        summary:
          data.mode === 'reference'
            ? 'Outputs the function reference.'
            : emitsValue
              ? 'Executes the function and exposes its result.'
              : 'Executes the function for side-effects.',
        value: typeof computedValue === 'undefined' ? (emitsValue ? null : undefined) : computedValue
      };
    }
    case 'function-argument': {
      const data = node.data as FunctionArgumentNodeData;
      const overrides = context.argumentValueOverrides;
      const hasOverride = overrides ? Object.prototype.hasOwnProperty.call(overrides, data.argumentId) : false;
      const value =
        overrides === undefined
          ? getArgumentSample(data.type)
          : hasOverride
            ? overrides?.[data.argumentId]
            : undefined;
      return {
        state: 'ready',
        heading: 'Argument',
        summary: `${data.name || 'Unnamed'} (${data.type})`,
        value
      };
    }
    case 'logical': {
      const data = node.data as LogicalOperatorNodeData;
      const config = getLogicalOperationConfig(data.operation);
      const overrides: { primary?: boolean; secondary?: boolean } = {};
      config.roles.forEach((role) => {
        const handleId = getLogicalHandleId(node.id, role);
        const binding = getBindingValue(handleId);
        if (!binding) {
          return;
        }
        const normalized = normalizeBoolean(binding.value);
        if (normalized === null) {
          logicLogger.warn('Invalid logical binding ignored', {
            nodeId: node.id,
            handleId,
            value: binding.value
          });
          return;
        }
        if (role === 'primary') {
          overrides.primary = normalized;
        } else {
          overrides.secondary = normalized;
        }
      });
      return evaluateLogicalOperatorPreview(data, overrides);
    }
    case 'list': {
      const data = node.data as ListNodeData;
      const overrides: ListInputOverrides = { nodeId: node.id };
      const primaryBinding = getBindingValue(getListHandleId(node.id, 'primary'));
      const secondaryBinding = getBindingValue(getListHandleId(node.id, 'secondary'));
      const startBinding = getBindingValue(getListHandleId(node.id, 'start'));
      const endBinding = getBindingValue(getListHandleId(node.id, 'end'));
      const orderBinding = getBindingValue(getListHandleId(node.id, 'order'));
      const callbackBinding = getBindingValue(getListHandleId(node.id, 'callback'));
      const initialBinding = getBindingValue(getListHandleId(node.id, 'initial'));
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
      if (startBinding) {
        overrides.start = normalizeNumber(startBinding.value);
      }
      if (endBinding) {
        overrides.end = normalizeNumber(endBinding.value);
      }
      if (orderBinding) {
        const order = normalizeSortOrderValue(orderBinding.value);
        if (order) {
          overrides.order = order;
        } else {
          logicLogger.warn('Invalid sort order binding ignored', {
            nodeId: node.id,
            handleId: orderBinding.handleId,
            value: orderBinding.value
          });
        }
      }
      if (callbackBinding) {
        if (isFunctionReferenceValue(callbackBinding.value)) {
          overrides.callbackRef = callbackBinding.value;
        } else {
          logicLogger.warn('Invalid callback binding ignored', {
            nodeId: node.id,
            handleId: callbackBinding.handleId
          });
        }
      }
      if (initialBinding) {
        const scalar = ensureScalar(initialBinding.value);
        if (scalar !== undefined) {
          overrides.initialValue = scalar;
        } else {
          logicLogger.warn('Invalid reduce initial binding ignored', {
            nodeId: node.id,
            handleId: initialBinding.handleId
          });
        }
      }
      return evaluateListPreview(data, overrides, {
        invokeCallback: (invocation) => invokeFunctionReference(invocation, context, node.id)
      });
    }
    case 'object': {
      const data = node.data as ObjectNodeData;
      const overrides: ObjectInputOverrides = {};
      const definitions = getObjectOperationInputs(data.operation);
      const roleToHandle = Object.fromEntries(
        definitions.map((definition) => [definition.role, getObjectHandleId(node.id, definition.role)])
      ) as Partial<Record<ObjectInputRole, string>>;
      definitions.forEach((definition) => {
        const handleId = roleToHandle[definition.role];
        if (!handleId) {
          return;
        }
        const binding = getBindingValue(handleId);
        if (!binding) {
          return;
        }
        switch (definition.role) {
          case 'source': {
            const obj = ensureObject(binding.value);
            if (obj) {
              overrides.sourceSample = obj;
            } else {
              logicLogger.warn('Invalid source object binding ignored', {
                nodeId: node.id,
                handleId,
                value: binding.value
              });
            }
            break;
          }
          case 'patch': {
            const obj = ensureObject(binding.value);
            if (obj) {
              overrides.patchSample = obj;
            } else {
              logicLogger.warn('Invalid patch object binding ignored', {
                nodeId: node.id,
                handleId,
                value: binding.value
              });
            }
            break;
          }
          case 'keys': {
            const keys = normalizeKeysInput(binding.value);
            if (keys) {
              overrides.selectedKeys = keys;
            } else {
              logicLogger.warn('Invalid keys binding ignored', {
                nodeId: node.id,
                handleId,
                value: binding.value
              });
            }
            break;
          }
          case 'key': {
            const path = normalizePathInput(binding.value);
            if (path) {
              overrides.path = path;
            } else {
              logicLogger.warn('Invalid key path binding ignored', {
                nodeId: node.id,
                handleId,
                value: binding.value
              });
            }
            break;
          }
          case 'value': {
            const scalar = ensureScalar(binding.value);
            if (scalar !== undefined) {
              overrides.valueSample = scalar;
            } else {
              logicLogger.warn('Invalid value binding ignored', {
                nodeId: node.id,
                handleId,
                value: binding.value
              });
            }
            break;
          }
          default:
            break;
        }
      });
      return evaluateObjectPreview(data, overrides);
    }
    case 'relational': {
      const data = node.data as RelationalOperatorNodeData;
      const overrides: { left?: ScalarValue; right?: ScalarValue } = {};
      const leftBinding = getBindingValue(getRelationalHandleId(node.id, 'left'));
      if (leftBinding) {
        const scalar = ensureScalar(leftBinding.value);
        if (scalar === undefined) {
          logicLogger.warn('Invalid relational left binding ignored', {
            nodeId: node.id,
            handleId: leftBinding.handleId
          });
        } else {
          overrides.left = scalar;
        }
      }
      const rightBinding = getBindingValue(getRelationalHandleId(node.id, 'right'));
      if (rightBinding) {
        const scalar = ensureScalar(rightBinding.value);
        if (scalar === undefined) {
          logicLogger.warn('Invalid relational right binding ignored', {
            nodeId: node.id,
            handleId: rightBinding.handleId
          });
        } else {
          overrides.right = scalar;
        }
      }
      return evaluateRelationalPreview(data, overrides);
    }
    case 'function-return': {
      const data = node.data as FunctionReturnNodeData;
      return {
        state: 'ready',
        heading: 'Return',
        summary: `Return handle ${data.returnId}`
      };
    }
    case 'query': {
      const data = node.data as QueryNodeData;
      const queryDef = context.queryDefinitions?.find((q) => q.id === data.queryId);
      if (!queryDef) {
        logicLogger.info('Query definition not found for main-canvas query node preview', {
          nodeId: node.id,
          queryId: data.queryId,
          queryName: data.queryName
        });
        return {
          state: 'ready',
          heading: data.queryName || 'Query',
          summary: `Mode: ${data.mode.toUpperCase()} | ${data.arguments.length} argument(s)`
        };
      }

      const schema = context.databases?.find((db) => db.id === queryDef.schemaId) ?? null;
      const flowNodes = toFlowNodes(queryDef.nodes);
      const flowEdges = toFlowEdges(queryDef.edges);
      const outputNode = flowNodes.find((n) => n.type === 'query-output');

      if (!outputNode) {
        logicLogger.warn('No output node in query definition for main-canvas preview', {
          nodeId: node.id,
          queryId: data.queryId,
          innerNodeCount: flowNodes.length
        });
        return {
          state: 'unknown',
          heading: data.queryName || 'Query',
          summary: 'Query has no output node.'
        };
      }

      logicLogger.debug('Assembling main-canvas query node preview', {
        nodeId: node.id,
        queryId: data.queryId,
        mode: queryDef.mode,
        innerNodeCount: flowNodes.length,
        innerEdgeCount: flowEdges.length,
        hasSchema: schema !== null
      });

      const sql = assembleFullSql(outputNode.id, flowNodes, flowEdges, queryDef.mode);
      const dataShape = inferFullDataShape(outputNode.id, flowNodes, flowEdges, schema, queryDef.mode);

      logicLogger.info('Main-canvas query node preview computed', {
        nodeId: node.id,
        queryId: data.queryId,
        columnCount: dataShape.length,
        sqlLength: sql.length
      });

      return {
        state: dataShape.length > 0 ? 'ready' : 'unknown',
        heading: data.queryName || 'Query',
        summary: dataShape.length > 0
          ? `Mode: ${data.mode.toUpperCase()} | ${dataShape.length} column(s)`
          : `Mode: ${data.mode.toUpperCase()} | No columns resolved`,
        sql,
        dataShape
      };
    }
    case 'query-table':
    case 'query-where':
    case 'query-join':
    case 'query-groupby':
    case 'query-having':
    case 'query-orderby':
    case 'query-limit':
    case 'query-aggregation':
    case 'query-attribute':
    case 'query-argument':
    case 'query-output': {
      return evaluateQueryNodePreview(node, {
        schema: context.querySchema ?? null,
        mode: context.queryMode ?? 'read',
        allNodes: context.allNodes,
        allEdges: context.allEdges
      });
    }
    default:
      return UNKNOWN_PREVIEW;
  }
};

export const createPreviewResolver = (
  nodes: Node<LogicEditorNodeData>[],
  edges: Edge[],
  options: PreviewResolverOptions = {}
): PreviewResolver => {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const incomingMap = buildIncomingMap(edges);
  const bindingCache = new Map<string, ConnectedBinding>();
  const previewCache = new Map<string, NodePreview>();
  const findHandleEdge = createHandleFinder(incomingMap);
  const functionsById = options.functionsById
    ? options.functionsById
    : options.functions
      ? new Map(options.functions.map((fn) => [fn.id, fn]))
      : undefined;
  const context: ResolverContext = {
    functionsById,
    argumentValueOverrides: options.argumentValueOverrides,
    callStack: options.callStack ?? [],
    querySchema: options.querySchema,
    queryMode: options.queryMode,
    allNodes: nodes,
    allEdges: edges,
    queryDefinitions: options.queryDefinitions,
    databases: options.databases
  };

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
    const preview = evaluateNodePreview(
      node,
      (handleId) => resolveBinding(nodeId, handleId),
      context
    );
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