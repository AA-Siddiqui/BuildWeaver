import { Node } from 'reactflow';
import {
  ArithmeticNodeData,
  ConditionalNodeData,
  DummyNodeData,
  FunctionArgumentNodeData,
  FunctionNodeData,
  FunctionReturnNodeData,
  ListNodeData,
  LogicalOperatorNodeData,
  ObjectNodeData,
  PageDocument,
  PageNodeData,
  RelationalOperatorNodeData,
  StringNodeData
} from '@buildweaver/libs';
import type { LogicEditorNodeData } from '@buildweaver/libs';

export type FlowNode = Node<LogicEditorNodeData>;
export type PaletteNodeType =
  | 'page'
  | 'dummy'
  | 'arithmetic'
  | 'string'
  | 'list'
  | 'object'
  | 'conditional'
  | 'logical'
  | 'relational';

export type FunctionOnlyPaletteNodeType = 'function-argument' | 'function-return';
export type ExtendedPaletteNodeType = PaletteNodeType | FunctionOnlyPaletteNodeType;

type Position = { x: number; y: number };

type FlowNodeFactory = (position?: Position) => FlowNode;

export const generateNodeId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
};

const DEFAULT_DUMMY_DATA: DummyNodeData = {
  kind: 'dummy',
  label: 'Sample data',
  description: 'Placeholder output',
  sample: {
    type: 'integer',
    value: 42
  }
};

export const createDummyData = (): DummyNodeData => ({
  ...DEFAULT_DUMMY_DATA,
  sample: { ...DEFAULT_DUMMY_DATA.sample }
});

export const createArithmeticData = (): ArithmeticNodeData => ({
  kind: 'arithmetic',
  label: 'Math block',
  description: 'Combine numbers',
  operation: 'add',
  precision: 2,
  operands: [
    { id: `op-${generateNodeId()}`, label: 'Input A', sampleValue: 12 },
    { id: `op-${generateNodeId()}`, label: 'Input B', sampleValue: 4 }
  ]
});

export const createStringData = (): StringNodeData => ({
  kind: 'string',
  label: 'String block',
  description: 'Transform strings',
  operation: 'concat',
  stringInputs: [
    { id: `str-${generateNodeId()}`, label: 'Text 1', role: 'text', sampleValue: 'Hello' },
    { id: `str-${generateNodeId()}`, label: 'Text 2', role: 'text', sampleValue: 'World' },
    { id: `str-${generateNodeId()}`, label: 'Delimiter', role: 'delimiter', sampleValue: ' ' }
  ],
  options: { delimiter: ' ' }
});

export const createListData = (): ListNodeData => ({
  kind: 'list',
  label: 'List block',
  description: 'Slice, merge, count lists',
  operation: 'append',
  primarySample: [1, 2, 3],
  secondarySample: [4, 5],
  startSample: 0,
  endSample: 3,
  sort: 'asc'
});

export const createObjectData = (): ObjectNodeData => ({
  kind: 'object',
  label: 'Object block',
  description: 'Merge and pick fields',
  operation: 'merge',
  sourceSample: { status: 'idle', attempts: 0 },
  patchSample: { status: 'ready' },
  selectedKeys: [],
  path: '',
  valueSample: '',
  valueSampleKind: 'string'
});

export const createConditionalData = (): ConditionalNodeData => ({
  kind: 'conditional',
  label: 'Conditional block',
  description: 'Branch between two values',
  conditionSample: true,
  trueValue: 'Enabled',
  falseValue: 'Disabled',
  trueValueKind: 'string',
  falseValueKind: 'string'
});

export const createLogicalData = (): LogicalOperatorNodeData => ({
  kind: 'logical',
  label: 'Logical block',
  description: 'Combine boolean inputs',
  operation: 'and',
  primarySample: true,
  secondarySample: false
});

export const createRelationalData = (): RelationalOperatorNodeData => ({
  kind: 'relational',
  label: 'Relational block',
  description: 'Compare two values',
  operation: 'gt',
  leftSample: 10,
  rightSample: 5,
  leftSampleKind: 'number',
  rightSampleKind: 'number'
});

export const createPageNode = (page: PageDocument, position: Position = { x: 0, y: 0 }): FlowNode => ({
  id: `page-${page.id}`,
  type: 'page',
  position,
  data: {
    kind: 'page',
    pageId: page.id,
    pageName: page.name,
    routeSegment: page.slug,
    inputs: page.dynamicInputs
  } satisfies PageNodeData
});

export const createDummyNode: FlowNodeFactory = (position = { x: 0, y: 0 }) => ({
  id: `dummy-${generateNodeId()}`,
  type: 'dummy',
  position,
  data: createDummyData()
});

export const createArithmeticFlowNode: FlowNodeFactory = (position = { x: 0, y: 0 }) => ({
  id: `arithmetic-${generateNodeId()}`,
  type: 'arithmetic',
  position,
  data: createArithmeticData()
});

export const createStringFlowNode: FlowNodeFactory = (position = { x: 0, y: 0 }) => ({
  id: `string-${generateNodeId()}`,
  type: 'string',
  position,
  data: createStringData()
});

export const createListFlowNode: FlowNodeFactory = (position = { x: 0, y: 0 }) => ({
  id: `list-${generateNodeId()}`,
  type: 'list',
  position,
  data: createListData()
});

export const createObjectFlowNode: FlowNodeFactory = (position = { x: 0, y: 0 }) => ({
  id: `object-${generateNodeId()}`,
  type: 'object',
  position,
  data: createObjectData()
});

export const createConditionalFlowNode: FlowNodeFactory = (position = { x: 0, y: 0 }) => ({
  id: `conditional-${generateNodeId()}`,
  type: 'conditional',
  position,
  data: createConditionalData()
});

export const createLogicalFlowNode: FlowNodeFactory = (position = { x: 0, y: 0 }) => ({
  id: `logical-${generateNodeId()}`,
  type: 'logical',
  position,
  data: createLogicalData()
});

export const createRelationalFlowNode: FlowNodeFactory = (position = { x: 0, y: 0 }) => ({
  id: `relational-${generateNodeId()}`,
  type: 'relational',
  position,
  data: createRelationalData()
});

export const createFunctionArgumentNode: FlowNodeFactory = (position = { x: 0, y: 0 }) => ({
  id: `function-argument-${generateNodeId()}`,
  type: 'function-argument',
  position,
  data: {
    kind: 'function-argument',
    argumentId: `arg-${generateNodeId()}`,
    name: 'argument',
    type: 'string'
  } satisfies FunctionArgumentNodeData
});

export const createFunctionReturnNode: FlowNodeFactory = (position = { x: 0, y: 0 }) => ({
  id: `function-return-${generateNodeId()}`,
  type: 'function-return',
  position,
  data: {
    kind: 'function-return',
    returnId: `ret-${generateNodeId()}`
  } satisfies FunctionReturnNodeData
});

export const createFunctionReferenceNode = (
  functionId: string,
  functionName: string,
  returnsValue: boolean,
  position: Position = { x: 0, y: 0 },
  mode: FunctionNodeData['mode'] = 'applied'
): FlowNode => ({
  id: `function-${generateNodeId()}`,
  type: 'function',
  position,
  data: {
    kind: 'function',
    functionId,
    functionName,
    mode,
    returnsValue
  }
});

export const staticNodeFactory: Record<Exclude<PaletteNodeType, 'page'>, FlowNodeFactory> = {
  dummy: createDummyNode,
  arithmetic: createArithmeticFlowNode,
  string: createStringFlowNode,
  list: createListFlowNode,
  object: createObjectFlowNode,
  conditional: createConditionalFlowNode,
  logical: createLogicalFlowNode,
  relational: createRelationalFlowNode
};

export const functionBuilderNodeFactory: Record<FunctionOnlyPaletteNodeType, FlowNodeFactory> = {
  'function-argument': createFunctionArgumentNode,
  'function-return': createFunctionReturnNode
};
