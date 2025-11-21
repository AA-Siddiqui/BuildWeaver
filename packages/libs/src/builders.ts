export type LogicEditorNodeType = 'page' | 'dummy';

export interface LogicEditorNodePosition {
  x: number;
  y: number;
}

export interface DummyNodeData {
  kind: 'dummy';
  label: string;
  value: number;
  description?: string;
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

export type LogicEditorNodeData = DummyNodeData | PageNodeData;

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