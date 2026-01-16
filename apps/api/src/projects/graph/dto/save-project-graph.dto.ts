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
  RelationalOperation,
  ScalarSampleKind,
  ScalarValue,
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

class GraphNodeDataDto {
  @IsIn([
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
    'database'
  ])
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

  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'function')
  @IsOptional()
  @IsBoolean()
  returnsValue?: boolean;

  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'function-argument')
  @IsString()
  argumentId?: string;

  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'function-argument')
  @IsString()
  name?: string;

  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'function-argument')
  @IsIn(['string', 'number', 'boolean', 'list', 'object'])
  type?: FunctionArgumentType;

  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'function-return')
  @IsString()
  returnId?: string;

  // Database node specifics
  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'database')
  @IsString()
  schemaId?: string;

  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'database')
  @IsString()
  schemaName?: string;

  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'database')
  @IsOptional()
  @IsString()
  selectedTableId?: string;

  @ValidateIf((node: GraphNodeDataDto) => node.kind === 'database')
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => DatabaseNodeTableDto)
  tables?: DatabaseNodeTableDto[];
}

class GraphNodeDto {
  @IsString()
  id!: string;

  @IsIn([
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
    'database'
  ])
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

class DatabaseNodeTableDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DatabaseFieldDto)
  fields!: DatabaseFieldDto[];
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
}
