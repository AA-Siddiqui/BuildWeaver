import type { DatabaseSchema, QueryDefinition, UserDefinedFunction } from './builders';

export const IR_VERSION = '2025.02.0';

export type ScalarValue =
  | string
  | number
  | boolean
  | null
  | ScalarValue[]
  | { [key: string]: ScalarValue };

export type TargetFramework = 'react-web' | 'flutter' | 'express-api';

export interface ProjectMetadata {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  generator: {
    name: string;
    version: string;
  };
  targetFrameworks: TargetFramework[];
  defaultLocale: string;
  locales: string[];
}

export interface Asset {
  id: string;
  type: 'image' | 'icon' | 'font' | 'file';
  name: string;
  description?: string;
  source: {
    kind: 'remote' | 'inline' | 'asset-store';
    uri?: string;
    data?: string;
    contentType?: string;
  };
  metadata?: Record<string, ScalarValue>;
}

export interface BaseDataSource {
  id: string;
  name: string;
  description?: string;
  provides?: string[];
}

export interface RestDataSource extends BaseDataSource {
  driver: 'rest';
  config: {
    baseUrl: string;
    path: string;
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    query?: Record<string, string>;
    headers?: Record<string, string>;
    bodyTemplate?: Record<string, unknown>;
  };
}

export interface GraphqlDataSource extends BaseDataSource {
  driver: 'graphql';
  config: {
    endpoint: string;
    query: string;
    operationName?: string;
    variables?: string[];
    headers?: Record<string, string>;
  };
}

export interface StaticDataSource extends BaseDataSource {
  driver: 'static';
  config: {
    data: unknown;
  };
}

export type DataSource = RestDataSource | GraphqlDataSource | StaticDataSource;

export type ScalarFieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'image'
  | 'json';

export interface ScalarFieldDefinition {
  kind: 'scalar';
  scalar: ScalarFieldType;
}

export interface ReferenceFieldDefinition {
  kind: 'reference';
  modelId: string;
  relation: 'one' | 'many';
}

export interface ArrayFieldDefinition {
  kind: 'array';
  of: ScalarFieldDefinition | ReferenceFieldDefinition;
}

export type DataFieldType =
  | ScalarFieldDefinition
  | ReferenceFieldDefinition
  | ArrayFieldDefinition;

export interface DataModelField {
  id: string;
  name: string;
  description?: string;
  required: boolean;
  type: DataFieldType;
}

export interface DataModel {
  id: string;
  name: string;
  description?: string;
  sourceId?: string;
  fields: DataModelField[];
}

export type BindingKind = 'data' | 'logic' | 'ui' | 'asset';

export interface BindingReference {
  kind: BindingKind;
  nodeId: string;
  portId?: string;
  path?: string;
  fallback?: ScalarValue;
}

export interface EventArgument {
  name: string;
  source: BindingReference;
}

export interface EventMapping {
  event: string;
  description?: string;
  targetNodeId: string;
  targetPortId: string;
  arguments?: EventArgument[];
}

export interface StyleDeclaration {
  classes?: string[];
  tokens?: string[];
  inline?: Record<string, string | number>;
}

export type PropValue =
  | ScalarValue
  | ScalarValue[]
  | Record<string, ScalarValue | ScalarValue[]>;

export interface UITreeNode {
  id: string;
  key: string;
  component: string;
  label: string;
  variant?: string;
  description?: string;
  slot?: string;
  props: Record<string, PropValue>;
  bindings: Record<string, BindingReference>;
  events: EventMapping[];
  style?: StyleDeclaration;
  children: UITreeNode[];
}

export interface AuthProvider {
  type: 'email' | 'google' | 'github' | 'custom';
  issuer?: string;
  clientId?: string;
  scopes?: string[];
}

export interface AuthRequirement {
  strategy: 'public' | 'jwt' | 'session';
  providers: AuthProvider[];
  redirectTo?: string;
  allowGuests?: boolean;
  metadata?: Record<string, ScalarValue>;
}

export interface PaymentRequirement {
  provider: 'xpay' | 'custom';
  planId: string;
  successPath?: string;
  cancelPath?: string;
  metadata?: Record<string, ScalarValue>;
}

export interface LogicPort {
  id: string;
  name: string;
  type: string;
  required?: boolean;
  acceptsMultiple?: boolean;
  defaultValue?: ScalarValue;
}

export interface BlockConfig {
  type: 'auth-guard' | 'paywall' | 'layout' | 'custom';
  entryNodeId?: string;
  exits?: string[];
  auth?: AuthRequirement;
  payment?: PaymentRequirement;
  metadata?: Record<string, ScalarValue>;
}

export type LogicNodeKind = 'data' | 'ui' | 'action' | 'block' | 'system';

export interface LogicNode {
  id: string;
  kind: LogicNodeKind;
  label: string;
  codeName?: string;
  handler: string;
  description?: string;
  category?: string;
  inputs: LogicPort[];
  outputs: LogicPort[];
  config?: Record<string, unknown>;
  block?: BlockConfig;
}

export interface PortReference {
  nodeId: string;
  portId: string;
}

export interface LogicEdge {
  id: string;
  description?: string;
  source: PortReference;
  target: PortReference;
}

export interface LogicGraph {
  nodes: LogicNode[];
  edges: LogicEdge[];
}

export interface BlockInstance {
  nodeId: string;
  slot: 'page' | 'layout' | 'custom';
  order: number;
}

export interface PageDynamicInputRef {
  id: string;
  label: string;
  description?: string;
  dataType: string;
  listItemType?: string;
  objectSample?: Record<string, ScalarValue>;
}

export interface Page {
  id: string;
  name: string;
  route: string;
  description?: string;
  seo?: Record<string, string>;
  entry: UITreeNode;
  auth?: AuthRequirement;
  payment?: PaymentRequirement;
  blocks?: BlockInstance[];
  builderState?: Record<string, unknown>;
  dynamicInputs?: PageDynamicInputRef[];
}

export interface ThemeTokens {
  colors?: Record<string, string>;
  spacingScale?: number[];
  typography?: {
    fontFamilies?: string[];
    baseSize?: number;
  };
}

export interface PageQueryConnection {
  pageId: string;
  queryId: string;
  inputId: string;
  inputLabel: string;
  queryMode: 'read' | 'insert' | 'update' | 'delete';
  schemaId: string;
}

export interface ProjectIR {
  version: string;
  metadata: ProjectMetadata;
  assets: Asset[];
  dataSources: DataSource[];
  dataModels: DataModel[];
  pages: Page[];
  logic: LogicGraph;
  theme?: ThemeTokens;
  databases?: DatabaseSchema[];
  queries?: QueryDefinition[];
  userFunctions?: UserDefinedFunction[];
  pageQueryConnections?: PageQueryConnection[];
}

const toSlug = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '') || 'project';

export const createEmptyProject = (name: string): ProjectIR => {
  const timestamp = new Date().toISOString();
  return {
    version: IR_VERSION,
    metadata: {
      id: `project_${Date.now()}`,
      name,
      slug: toSlug(name),
      createdAt: timestamp,
      updatedAt: timestamp,
      generator: {
        name: 'buildweaver',
        version: IR_VERSION
      },
      targetFrameworks: ['react-web'],
      defaultLocale: 'en',
      locales: ['en'],
      tags: []
    },
    assets: [],
    dataSources: [],
    dataModels: [],
    pages: [],
    logic: {
      nodes: [],
      edges: []
    }
  };
};
