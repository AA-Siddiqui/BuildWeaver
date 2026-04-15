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

export interface ProjectCheckpointCounts {
  pages: number;
  components: number;
  deployments: number;
  graphNodes: number;
  graphEdges: number;
  functions: number;
  databases: number;
  queries: number;
}

export interface ProjectCheckpointSummary {
  id: string;
  projectId: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  capturedAt: string;
  counts: ProjectCheckpointCounts;
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
  RelationalOperatorNodeData,
  DatabaseSchema,
  DatabaseTable,
  DatabaseField,
  DatabaseRelationship,
  DatabaseConnectionSettings,
  RelationshipCardinality,
  RelationshipModality,
  QueryNodeData,
  QueryDefinition,
  QueryArgument,
  QueryMode
} from '@buildweaver/libs';
