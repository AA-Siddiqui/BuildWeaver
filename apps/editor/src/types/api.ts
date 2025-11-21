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
  LogicEditorNodeData,
  LogicEditorNode,
  LogicEditorEdge,
  DummyNodeData,
  PageNodeData
} from '@buildweaver/libs';
