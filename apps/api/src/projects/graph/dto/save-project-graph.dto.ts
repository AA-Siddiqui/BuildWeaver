import {
  ArithmeticOperation,
  DummySampleType,
  FunctionArgumentType,
  FunctionNodeMode,
  LogicEditorEdge,
  LogicEditorNode,
  ListOperation,
  LogicalOperation,
  ObjectOperation,
  ObjectValueSampleKind,
  PageDynamicInputDataType,
  PageDynamicListItemType,
  QueryDefinition,
  QueryMode,
  RelationalOperation,
  ScalarSampleKind,
  ScalarValue,
  SqlAggregateFunction,
  SqlJoinType,
  SqlOperator,
  SqlSortOrder,
  StringNodeInputRole,
  StringOperation,
  UserDefinedFunction,
  DatabaseFieldType
} from '@buildweaver/libs';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsNumber, IsObject, IsOptional, IsString, ValidateIf, ValidateNested } from 'class-validator';

const LOGIC_OPERATIONS = [
  'add',
  'subtract',
  'multiply',
  'divide',
  'exponent',
  'modulo',
  'average',
  'min',
  'max',
  'concat',
  'uppercase',
  'lowercase',
  'trim',
  'slice',
  'replace',
  'length',
  'append',
  'merge',
  'unique',
  'sort',
  'map',
  'filter',
  'reduce',
  'set',
  'get',
  'keys',
  'values',
  'pick',
  'and',
  'or',
  'not',
  'gt',
  'gte',
  'lt',
  'lte',
  'eq',
  'neq'
] as const;

class GraphNodePositionDto {
  @IsNumber()
  x!: number;

  @IsNumber()
  y!: number;
}

class PageNodeInputDto {
  @IsString()
  id!: string;

  @IsString()
  label!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(['string', 'number', 'boolean', 'object', 'list'])
  dataType!: PageDynamicInputDataType;

  @ValidateIf((input: PageNodeInputDto) => input.dataType === 'list')
  @IsOptional()
  @IsIn(['string', 'number', 'boolean', 'object'])
  listItemType?: PageDynamicListItemType;

  @ValidateIf((input: PageNodeInputDto) =>
    input.dataType === 'object' || (input.dataType === 'list' && input.listItemType === 'object')
  )
  @IsOptional()
  @IsObject()
  objectSample?: Record<string, ScalarValue>;
}

class DummySampleDto {
  @IsIn(['integer', 'decimal', 'string', 'boolean', 'list', 'object'])
  type!: DummySampleType;

  @IsOptional()
  value?: unknown;

  @IsOptional()
  @IsNumber()
  precision?: number;
}

class ArithmeticOperandDto {
  @IsString()
  id!: string;

  @IsString()
  label!: string;

  @IsOptional()
  @IsNumber()
  sampleValue?: number;
}

class StringInputDto {
  @IsString()
  id!: string;

  @IsString()
  label!: string;

  @IsOptional()
  @IsString()
  sampleValue?: string;

  @IsOptional()
  @IsIn(['text', 'delimiter', 'search', 'replace', 'start', 'end'])
  role?: StringNodeInputRole;
}

class StringOptionsDto {
  @IsOptional()
  @IsString()
  delimiter?: string;

  @IsOptional()
  @IsNumber()
  start?: number;

  @IsOptional()
  @IsNumber()
  end?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  replace?: string;
}

const ALL_NODE_KINDS = [
  'dummy',
  'page',
  'arithmetic',
  'string',
  'list',
  'object',
  'conditional',
  'logical',
  'relational',
  'function',
  'function-argument',
  'function-return',
  'query',
  'query-argument',
  'query-output',
  'query-table',
  'query-join',
  'query-where',
  'query-groupby',
  'query-having',
  'query-orderby',
  'query-limit',
  'query-aggregation',
  'query-attribute'
] as const;

class GraphNodeDataDto {
  @IsIn(ALL_NODE_KINDS)
  kind!: LogicEditorNode['type'];

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  pageId?: string;

  @IsOptional()
  @IsString()
  pageName?: string;

  @IsOptional()
  @IsString()
  routeSegment?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PageNodeInputDto)
  inputs?: PageNodeInputDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => DummySampleDto)
  sample?: DummySampleDto;

  @IsOptional()
  @IsIn(LOGIC_OPERATIONS)
  operation?:
    | ArithmeticOperation
    | StringOperation
    | ListOperation
    | ObjectOperation
    | LogicalOperation
    | RelationalOperation;

  @IsOptional()
  @IsNumber()
  precision?: number;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ArithmeticOperandDto)
  operands?: ArithmeticOperandDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => StringInputDto)
  stringInputs?: StringInputDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => StringOptionsDto)
  options?: StringOptionsDto;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sort?: 'asc' | 'desc';

  @IsOptional()
  reducerInitialSample?: unknown;

  @IsOptional()
  @IsIn(['string', 'number', 'boolean', 'list', 'object'])
  reducerInitialSampleKind?: ScalarSampleKind;

  @IsOptional()
  @ValidateIf((_, value) => Array.isArray(value))
  @IsArray()
  primarySample?: Array<string | number | boolean | null> | boolean;

  @IsOptional()
  @ValidateIf((_, value) => Array.isArray(value))
  @IsArray()
  secondarySample?: Array<string | number | boolean | null> | boolean;

  @IsOptional()
  @IsNumber()
  startSample?: number | null;

  @IsOptional()
  @IsNumber()
  endSample?: number | null;

  @IsOptional()
  @IsObject()
  sourceSample?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  patchSample?: Record<string, unknown>;

  @IsOptional()
  valueSample?: unknown;

  @IsOptional()
  @IsIn(['string', 'number', 'boolean', 'list', 'object'])
  valueSampleKind?: ObjectValueSampleKind;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedKeys?: string[];

  @IsOptional()
  @IsString()
  path?: string;

  @IsOptional()
  @IsBoolean()
  conditionSample?: boolean;

  @IsOptional()
  trueValue?: unknown;

  @IsOptional()
  falseValue?: unknown;

  @IsOptional()
  @IsIn(['string', 'number', 'boolean', 'list', 'object'])
  trueValueKind?: ScalarSampleKind;

  @IsOptional()
  @IsIn(['string', 'number', 'boolean', 'list', 'object'])
  falseValueKind?: ScalarSampleKind;

  @IsOptional()
  leftSample?: unknown;

  @IsOptional()
  rightSample?: unknown;

  @IsOptional()
  @IsIn(['string', 'number', 'boolean', 'list', 'object'])
  leftSampleKind?: ScalarSampleKind;

  @IsOptional()
  @IsIn(['string', 'number', 'boolean', 'list', 'object'])
  rightSampleKind?: ScalarSampleKind;

  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'function')
  @IsString()
  functionId?: string;

  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'function')
  @IsOptional()
  @IsString()
  functionName?: string;

  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'function')
  @IsIn(['applied', 'reference'])
  mode?: FunctionNodeMode;

  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'query')
  @IsOptional()
  @IsIn(['read', 'insert', 'update', 'delete'])
  queryMode?: QueryMode;

  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'function')
  @IsOptional()
  @IsBoolean()
  returnsValue?: boolean;

  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'function-argument' || node.kind === 'query-argument')
  @IsString()
  argumentId?: string;

  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'function-argument' || node.kind === 'query-argument')
  @IsString()
  name?: string;

  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'function-argument' || node.kind === 'query-argument')
  @IsIn(['string', 'number', 'boolean', 'list', 'object'])
  type?: FunctionArgumentType;

  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'function-return')
  @IsString()
  returnId?: string;

  // Query node specifics (main canvas)
  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'query')
  @IsString()
  queryId?: string;

  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'query')
  @IsOptional()
  @IsString()
  queryName?: string;

  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'query' || node.kind === 'query-table')
  @IsOptional()
  @IsString()
  schemaId?: string;

  // Query-argument node
  // argumentId, name, type are shared with function-argument (ValidateIf already covers both)

  // Query-output node
  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'query-output')
  @IsString()
  outputId?: string;

  // Query-table node
  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'query-table')
  @IsOptional()
  @IsString()
  tableId?: string;

  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'query-table')
  @IsOptional()
  @IsString()
  tableName?: string;

  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'query-table')
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedColumns?: string[];

  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'query-table')
  @IsOptional()
  @IsObject()
  columnDefaults?: Record<string, string>;

  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'query-table')
  @IsOptional()
  @IsNumber()
  aggregationInputCount?: number;

  // Query-join node
  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'query-join')
  @IsOptional()
  @IsIn(['inner', 'left', 'right', 'full'])
  joinType?: SqlJoinType;

  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'query-join')
  @IsOptional()
  @IsString()
  tableA?: string;

  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'query-join')
  @IsOptional()
  @IsString()
  tableB?: string;

  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'query-join')
  @IsOptional()
  @IsString()
  attributeA?: string;

  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'query-join')
  @IsOptional()
  @IsString()
  attributeB?: string;

  // Query-where and query-having nodes
  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'query-where' || node.kind === 'query-having')
  @IsOptional()
  @IsIn(['=', '!=', '>', '<', '>=', '<=', 'in', 'not in', 'like', 'not like', 'is null', 'is not null'])
  operator?: SqlOperator;

  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'query-where' || node.kind === 'query-having')
  @IsOptional()
  @IsString()
  leftOperand?: string;

  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'query-where' || node.kind === 'query-having')
  @IsOptional()
  @IsString()
  rightOperand?: string;

  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'query-where' || node.kind === 'query-having')
  @IsOptional()
  @IsBoolean()
  leftIsColumn?: boolean;

  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'query-where' || node.kind === 'query-having')
  @IsOptional()
  @IsBoolean()
  rightIsColumn?: boolean;

  // Query-groupby node
  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'query-groupby')
  @IsOptional()
  @IsNumber()
  groupingAttributeCount?: number;

  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'query-groupby')
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attributes?: string[];

  // Query-orderby node
  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'query-orderby')
  @IsOptional()
  @IsNumber()
  sortCount?: number;

  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'query-orderby')
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sortAttributes?: string[];

  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'query-orderby')
  @IsOptional()
  @IsArray()
  @IsIn(['asc', 'desc'], { each: true })
  sortOrders?: SqlSortOrder[];

  // Query-limit node
  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'query-limit')
  @IsOptional()
  @IsNumber()
  limitValue?: number;

  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'query-limit')
  @IsOptional()
  @IsNumber()
  offsetValue?: number;

  // Query-aggregation node
  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'query-aggregation')
  @IsOptional()
  @IsIn(['sum', 'max', 'min', 'count', 'avg'])
  function?: SqlAggregateFunction;

  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'query-aggregation' || node.kind === 'query-attribute')
  @IsOptional()
  @IsString()
  attribute?: string;

  // Query-attribute node
  // tableName is used by query-aggregation too
  @ValidateIf((node: GraphNodeDataDto) =>
    node.kind === 'query-attribute' || node.kind === 'query-aggregation'
  )
  @IsOptional()
  @IsString()
  attributeTableName?: string;

  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'query-attribute')
  @IsOptional()
  @IsString()
  attributeName?: string;
}

class GraphNodeDto {
  @IsString()
  id!: string;

  @IsIn(ALL_NODE_KINDS)
  type!: LogicEditorNode['type'];

  @ValidateNested()
  @Type(() => GraphNodePositionDto)
  position!: GraphNodePositionDto;

  @ValidateNested()
  @Type(() => GraphNodeDataDto)
  data!: GraphNodeDataDto;
}

class GraphEdgeDto {
  @IsString()
  id!: string;

  @IsString()
  source!: string;

  @IsString()
  target!: string;

  @IsOptional()
  @IsString()
  sourceHandle?: string;

  @IsOptional()
  @IsString()
  targetHandle?: string;

  @IsOptional()
  @IsString()
  label?: string;
}

class FunctionArgumentDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsIn(['string', 'number', 'boolean', 'list', 'object'])
  type!: FunctionArgumentType;
}

class UserFunctionDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GraphNodeDto)
  nodes!: LogicEditorNode[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GraphEdgeDto)
  edges!: LogicEditorEdge[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FunctionArgumentDto)
  arguments!: FunctionArgumentDto[];

  @IsBoolean()
  returnsValue!: boolean;
}

class DatabaseFieldDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsIn(['uuid', 'string', 'number', 'boolean', 'json', 'date', 'datetime'])
  type!: DatabaseFieldType;

  @IsOptional()
  @IsString()
  defaultValue?: string;

  @IsBoolean()
  nullable!: boolean;

  @IsBoolean()
  unique!: boolean;

  @IsOptional()
  @IsBoolean()
  isId?: boolean;
}

class DatabaseTableDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DatabaseFieldDto)
  fields!: DatabaseFieldDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => GraphNodePositionDto)
  position?: GraphNodePositionDto;
}

class DatabaseRelationshipDto {
  @IsString()
  id!: string;

  @IsString()
  sourceTableId!: string;

  @IsString()
  targetTableId!: string;

  @IsIn(['one', 'many'])
  cardinality!: 'one' | 'many';

  @IsIn([0, 1])
  modality!: 0 | 1;

  @IsOptional()
  @IsString()
  description?: string;
}

class DatabaseConnectionDto {
  @IsString()
  host!: string;

  @IsNumber()
  port!: number;

  @IsString()
  database!: string;

  @IsString()
  user!: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsBoolean()
  ssl?: boolean;
}

class DatabaseSchemaDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DatabaseTableDto)
  tables!: DatabaseTableDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DatabaseRelationshipDto)
  relationships!: DatabaseRelationshipDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => DatabaseConnectionDto)
  connection?: DatabaseConnectionDto;

  @IsOptional()
  @IsString()
  updatedAt?: string;
}

class QueryArgumentDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsIn(['string', 'number', 'boolean', 'list', 'object'])
  type!: ScalarSampleKind;
}

class QueryDefinitionDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsIn(['read', 'insert', 'update', 'delete'])
  mode!: QueryMode;

  @IsString()
  schemaId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GraphNodeDto)
  nodes!: LogicEditorNode[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GraphEdgeDto)
  edges!: LogicEditorEdge[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QueryArgumentDto)
  arguments!: QueryArgumentDto[];

  @IsOptional()
  @IsString()
  updatedAt?: string;
}

export class SaveProjectGraphDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GraphNodeDto)
  nodes!: LogicEditorNode[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GraphEdgeDto)
  edges!: LogicEditorEdge[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserFunctionDto)
  functions!: UserDefinedFunction[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => DatabaseSchemaDto)
  databases?: DatabaseSchemaDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QueryDefinitionDto)
  queries?: QueryDefinition[];
}
