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
  RelationalOperation,
  ScalarSampleKind,
  StringNodeInputRole,
  StringOperation,
  UserDefinedFunction
} from '@buildweaver/libs';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsNumber, IsObject, IsOptional, IsString, ValidateIf, ValidateNested } from 'class-validator';

const LOGIC_OPERATIONS = [
  'add',
  'subtract',
  'multiply',
  'divide',
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

  @IsIn(['string', 'number', 'boolean'])
  dataType!: 'string' | 'number' | 'boolean';
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
    'function-return'
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
    'function-return'
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
}
