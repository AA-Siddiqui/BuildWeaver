import {
  ArithmeticOperation,
  DummySampleType,
  LogicEditorEdge,
  LogicEditorNode,
  ListOperation,
  ObjectOperation,
  StringNodeInputRole,
  StringOperation
} from '@buildweaver/libs';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

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
  'take',
  'unique',
  'sort',
  'set',
  'get',
  'keys',
  'values',
  'pick'
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

  @IsOptional()
  @IsNumber()
  limit?: number;
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
  @IsIn(['dummy', 'page', 'arithmetic', 'string', 'list', 'object'])
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
  operation?: ArithmeticOperation | StringOperation | ListOperation | ObjectOperation;

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
  @IsNumber()
  limit?: number;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sort?: 'asc' | 'desc';

  @IsOptional()
  @IsArray()
  primarySample?: Array<string | number | boolean | null>;

  @IsOptional()
  @IsArray()
  secondarySample?: Array<string | number | boolean | null>;

  @IsOptional()
  @IsObject()
  sourceSample?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  patchSample?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedKeys?: string[];

  @IsOptional()
  @IsString()
  path?: string;
}

class GraphNodeDto {
  @IsString()
  id!: string;

  @IsIn(['dummy', 'page', 'arithmetic', 'string', 'list', 'object'])
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

export class SaveProjectGraphDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GraphNodeDto)
  nodes!: LogicEditorNode[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GraphEdgeDto)
  edges!: LogicEditorEdge[];
}
