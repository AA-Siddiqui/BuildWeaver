import { ScalarValue } from './ir';

export type ScalarSampleKind = 'string' | 'number' | 'boolean' | 'list' | 'object';

export type LogicEditorNodeType =
  | 'page'
  | 'dummy'
  | 'arithmetic'
  | 'string'
  | 'list'
  | 'object'
  | 'conditional'
  | 'logical'
  | 'relational'
  | 'function'
  | 'function-argument'
  | 'function-return'
  | 'query'
  | 'query-argument'
  | 'query-output'
  | 'query-table'
  | 'query-join'
  | 'query-where'
  | 'query-groupby'
  | 'query-having'
  | 'query-orderby'
  | 'query-limit'
  | 'query-aggregation'
  | 'query-attribute';

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

export type ArithmeticOperation =
  | 'add'
  | 'subtract'
  | 'multiply'
  | 'divide'
  | 'exponent'
  | 'modulo'
  | 'average'
  | 'min'
  | 'max';

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

export type ListOperation = 'append' | 'merge' | 'slice' | 'unique' | 'sort' | 'length' | 'map' | 'filter' | 'reduce';

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
  reducerInitialSample?: ScalarValue;
  reducerInitialSampleKind?: ScalarSampleKind;
}

export type ObjectOperation = 'merge' | 'pick' | 'set' | 'get' | 'keys' | 'values';

export type ObjectValueSampleKind = ScalarSampleKind;

export interface ObjectNodeData {
  kind: 'object';
  label: string;
  description?: string;
  operation: ObjectOperation;
  sourceSample?: Record<string, ScalarValue>;
  patchSample?: Record<string, ScalarValue>;
  selectedKeys?: string[];
  path?: string;
  valueSample?: ScalarValue;
  valueSampleKind?: ObjectValueSampleKind;
}

export interface ConditionalNodeData {
  kind: 'conditional';
  label: string;
  description?: string;
  conditionSample?: boolean;
  trueValue?: ScalarValue;
  falseValue?: ScalarValue;
  trueValueKind?: ScalarSampleKind;
  falseValueKind?: ScalarSampleKind;
}

export type LogicalOperation = 'and' | 'or' | 'not';

export interface LogicalOperatorNodeData {
  kind: 'logical';
  label: string;
  description?: string;
  operation: LogicalOperation;
  primarySample?: boolean;
  secondarySample?: boolean;
}

export type RelationalOperation = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';

export interface RelationalOperatorNodeData {
  kind: 'relational';
  label: string;
  description?: string;
  operation: RelationalOperation;
  leftSample?: ScalarValue;
  rightSample?: ScalarValue;
  leftSampleKind?: ScalarSampleKind;
  rightSampleKind?: ScalarSampleKind;
}

export type FunctionArgumentType = ScalarSampleKind;

export type FunctionNodeMode = 'applied' | 'reference';

export interface FunctionNodeData {
  kind: 'function';
  functionId: string;
  functionName: string;
  description?: string;
  mode: FunctionNodeMode;
  returnsValue?: boolean;
}

export interface FunctionReferenceValue {
  kind: 'function-reference';
  functionId: string;
  functionName?: string;
  argumentTypes?: FunctionArgumentType[];
  returnsValue?: boolean;
  [key: string]: ScalarValue | undefined;
}

export interface FunctionArgumentNodeData {
  kind: 'function-argument';
  argumentId: string;
  name: string;
  type: FunctionArgumentType;
}

export interface FunctionReturnNodeData {
  kind: 'function-return';
  returnId: string;
}

export type PageDynamicInputDataType = 'string' | 'number' | 'boolean' | 'object' | 'list';

export type PageDynamicListItemType = Exclude<PageDynamicInputDataType, 'list'>;

export interface PageDynamicInput {
  id: string;
  label: string;
  description?: string;
  dataType: PageDynamicInputDataType;
  listItemType?: PageDynamicListItemType;
  objectSample?: Record<string, ScalarValue>;
}

export interface PageNodeData {
  kind: 'page';
  pageId: string;
  pageName: string;
  routeSegment?: string;
  inputs: PageDynamicInput[];
}

export type DatabaseFieldType =
  | 'uuid'
  | 'string'
  | 'number'
  | 'boolean'
  | 'json'
  | 'date'
  | 'datetime';

export interface DatabaseField {
  id: string;
  name: string;
  type: DatabaseFieldType;
  defaultValue?: string;
  nullable: boolean;
  unique: boolean;
  isId?: boolean;
}

export interface DatabaseTable {
  id: string;
  name: string;
  fields: DatabaseField[];
  position?: LogicEditorNodePosition;
}

export type RelationshipCardinality = 'one' | 'many';

export type RelationshipModality = 0 | 1;

export interface DatabaseRelationship {
  id: string;
  sourceTableId: string;
  targetTableId: string;
  cardinality: RelationshipCardinality;
  modality: RelationshipModality;
  description?: string;
}

export interface DatabaseConnectionSettings {
  host: string;
  port: number;
  database: string;
  user: string;
  password?: string;
  ssl?: boolean;
}

export interface DatabaseSchema {
  id: string;
  name: string;
  tables: DatabaseTable[];
  relationships: DatabaseRelationship[];
  connection?: DatabaseConnectionSettings;
  updatedAt?: string;
}

// ── Query node types ──────────────────────────────────────────────

export type QueryMode = 'read' | 'insert' | 'update' | 'delete';

export type SqlOperator =
  | '='
  | '!='
  | '>'
  | '<'
  | '>='
  | '<='
  | 'in'
  | 'not in'
  | 'like'
  | 'not like'
  | 'is null'
  | 'is not null';

export type SqlJoinType = 'inner' | 'left' | 'right' | 'full';

export type SqlAggregateFunction = 'sum' | 'max' | 'min' | 'count' | 'avg';

export type SqlSortOrder = 'asc' | 'desc';

/** Main-canvas query node – references a QueryDefinition by id. */
export interface QueryNodeData {
  kind: 'query';
  queryId: string;
  queryName: string;
  mode: QueryMode;
  schemaId: string;
  arguments: Array<{ id: string; name: string; type: string }>;
}

/** Inner: passes an external value into the query as a parameter. */
export interface QueryArgumentNodeData {
  kind: 'query-argument';
  argumentId: string;
  name: string;
  type: ScalarSampleKind;
}

/** Inner: collects the query result (built-in, non-removable). */
export interface QueryOutputNodeData {
  kind: 'query-output';
  outputId: string;
}

/** Inner: represents a database table in the query. */
export interface QueryTableNodeData {
  kind: 'query-table';
  tableId: string;
  tableName: string;
  schemaId: string;
  selectedColumns: string[];
  columnDefaults: Record<string, string>;
  aggregationInputCount: number;
}

/** Inner: SQL JOIN clause. */
export interface QueryJoinNodeData {
  kind: 'query-join';
  joinType: SqlJoinType;
  tableA?: string;
  tableB?: string;
  attributeA?: string;
  attributeB?: string;
}

/** Inner: SQL WHERE clause. */
export interface QueryWhereNodeData {
  kind: 'query-where';
  operator: SqlOperator;
  leftOperand?: string;
  rightOperand?: string;
  leftIsColumn: boolean;
  rightIsColumn: boolean;
}

/** Inner: SQL GROUP BY clause. */
export interface QueryGroupByNodeData {
  kind: 'query-groupby';
  groupingAttributeCount: number;
  attributes: string[];
}

/** Inner: SQL HAVING clause (structurally identical to WHERE). */
export interface QueryHavingNodeData {
  kind: 'query-having';
  operator: SqlOperator;
  leftOperand?: string;
  rightOperand?: string;
  leftIsColumn: boolean;
  rightIsColumn: boolean;
}

/** Inner: SQL ORDER BY clause. */
export interface QueryOrderByNodeData {
  kind: 'query-orderby';
  sortCount: number;
  sortAttributes: string[];
  sortOrders: SqlSortOrder[];
}

/** Inner: SQL LIMIT / OFFSET clause. */
export interface QueryLimitNodeData {
  kind: 'query-limit';
  limitValue?: number;
  offsetValue?: number;
}

/** Inner: SQL aggregate function (SUM, MAX, …). */
export interface QueryAggregationNodeData {
  kind: 'query-aggregation';
  function: SqlAggregateFunction;
  attribute?: string;
  tableName?: string;
}

/** Inner: references a specific table attribute. */
export interface QueryAttributeNodeData {
  kind: 'query-attribute';
  tableName?: string;
  attributeName?: string;
}

export type LogicEditorNodeData =
  | DummyNodeData
  | PageNodeData
  | ArithmeticNodeData
  | StringNodeData
  | ListNodeData
  | ObjectNodeData
  | ConditionalNodeData
  | LogicalOperatorNodeData
  | RelationalOperatorNodeData
  | FunctionNodeData
  | FunctionArgumentNodeData
  | FunctionReturnNodeData
  | QueryNodeData
  | QueryArgumentNodeData
  | QueryOutputNodeData
  | QueryTableNodeData
  | QueryJoinNodeData
  | QueryWhereNodeData
  | QueryGroupByNodeData
  | QueryHavingNodeData
  | QueryOrderByNodeData
  | QueryLimitNodeData
  | QueryAggregationNodeData
  | QueryAttributeNodeData;

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

export interface UserFunctionArgument {
  id: string;
  name: string;
  type: FunctionArgumentType;
}

export interface UserDefinedFunction {
  id: string;
  name: string;
  description?: string;
  nodes: LogicEditorNode[];
  edges: LogicEditorEdge[];
  arguments: UserFunctionArgument[];
  returnsValue: boolean;
  updatedAt?: string;
}

export interface QueryArgument {
  id: string;
  name: string;
  type: ScalarSampleKind;
}

export interface QueryDefinition {
  id: string;
  name: string;
  mode: QueryMode;
  schemaId: string;
  nodes: LogicEditorNode[];
  edges: LogicEditorEdge[];
  arguments: QueryArgument[];
  updatedAt?: string;
}

export interface ProjectGraphSnapshot {
  nodes: LogicEditorNode[];
  edges: LogicEditorEdge[];
  functions: UserDefinedFunction[];
  databases?: DatabaseSchema[];
  queries?: QueryDefinition[];
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

export type BuilderComponentDefinition = Record<string, unknown>;

export type ComponentBindingReference = {
  bindingId: string;
  propertyPath?: string[];
  componentId?: string;
  componentType?: string;
  exposeAsParameter?: boolean;
};

export interface ProjectComponentDocument {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  definition: BuilderComponentDefinition;
  bindingReferences: ComponentBindingReference[];
  createdAt: string;
  updatedAt: string;
}