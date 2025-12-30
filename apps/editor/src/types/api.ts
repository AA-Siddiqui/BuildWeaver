export interface AuthUser {
  id: string;
  email: string;
}

export interface Project {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export type {
  PageDocument,
  PageDynamicInput,
  PageBuilderState,
  ProjectGraphSnapshot,
  ProjectComponentDocument,
  ComponentBindingReference,
  LogicEditorNodeData,
  LogicEditorNode,
  LogicEditorEdge,
  FunctionNodeData,
  UserDefinedFunction,
  DummyNodeData,
  PageNodeData,
  ArithmeticNodeData,
  StringNodeData,
  ListNodeData,
  ObjectNodeData,
  ConditionalNodeData,
  LogicalOperatorNodeData,
  RelationalOperatorNodeData
} from '@buildweaver/libs';
