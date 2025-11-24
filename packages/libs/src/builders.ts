import { ScalarValue } from './ir';

export type LogicEditorNodeType = 'page' | 'dummy' | 'arithmetic' | 'string' | 'list' | 'object';

export interface LogicEditorNodePosition {
  x: number;
  y: number;
}

export type DummySampleType = 'integer' | 'decimal' | 'string' | 'boolean' | 'list' | 'object';

export type DummySampleValue =
  | { type: 'integer'; value: number }
  | { type: 'decimal'; value: number; precision?: number }
  | { type: 'string'; value: string }
  | { type: 'boolean'; value: boolean }
  | { type: 'list'; value: ScalarValue[] }
  | { type: 'object'; value: Record<string, ScalarValue> };

export interface DummyNodeData {
  kind: 'dummy';
  label: string;
  description?: string;
  sample: DummySampleValue;
}

export type ArithmeticOperation = 'add' | 'subtract' | 'multiply' | 'divide' | 'modulo' | 'average' | 'min' | 'max';

export interface ArithmeticOperand {
  id: string;
  label: string;
  sampleValue?: number | null;
  allowsUnknown?: boolean;
}

export interface ArithmeticNodeData {
  kind: 'arithmetic';
  label: string;
  description?: string;
  operation: ArithmeticOperation;
  precision: number;
  operands: ArithmeticOperand[];
}

export type StringOperation = 'concat' | 'uppercase' | 'lowercase' | 'trim' | 'slice' | 'replace' | 'length';

export type StringNodeInputRole = 'text' | 'delimiter' | 'search' | 'replace' | 'start' | 'end';

export interface StringNodeInput {
  id: string;
  label: string;
  sampleValue?: string;
  role?: StringNodeInputRole;
}

export interface StringNodeOptions {
  delimiter?: string;
  start?: number;
  end?: number;
  search?: string;
  replace?: string;
}

export interface StringNodeData {
  kind: 'string';
  label: string;
  description?: string;
  operation: StringOperation;
  stringInputs: StringNodeInput[];
  options?: StringNodeOptions;
}

export type ListOperation = 'append' | 'merge' | 'slice' | 'unique' | 'sort' | 'length';

export interface ListNodeData {
  kind: 'list';
  label: string;
  description?: string;
  operation: ListOperation;
  primarySample?: ScalarValue[];
  secondarySample?: ScalarValue[];
  startSample?: number | null;
  endSample?: number | null;
  sort?: 'asc' | 'desc';
}

export type ObjectOperation = 'merge' | 'pick' | 'set' | 'get' | 'keys' | 'values';

export interface ObjectNodeData {
  kind: 'object';
  label: string;
  description?: string;
  operation: ObjectOperation;
  sourceSample?: Record<string, ScalarValue>;
  patchSample?: Record<string, ScalarValue>;
  selectedKeys?: string[];
  path?: string;
}

export interface PageDynamicInput {
  id: string;
  label: string;
  description?: string;
  dataType: 'string' | 'number' | 'boolean';
}

export interface PageNodeData {
  kind: 'page';
  pageId: string;
  pageName: string;
  routeSegment?: string;
  inputs: PageDynamicInput[];
}

export type LogicEditorNodeData =
  | DummyNodeData
  | PageNodeData
  | ArithmeticNodeData
  | StringNodeData
  | ListNodeData
  | ObjectNodeData;

export interface LogicEditorNode {
  id: string;
  type: LogicEditorNodeType;
  position: LogicEditorNodePosition;
  data: LogicEditorNodeData;
}

export interface LogicEditorEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}

export interface ProjectGraphSnapshot {
  nodes: LogicEditorNode[];
  edges: LogicEditorEdge[];
}

export type PageBuilderState = Record<string, unknown>;

export interface PageDocument {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  builderState: PageBuilderState;
  dynamicInputs: PageDynamicInput[];
  createdAt: string;
  updatedAt: string;
}