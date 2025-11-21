import { LogicEditorEdge, LogicEditorNode } from '@buildweaver/libs';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

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

class GraphNodeDataDto {
  @IsIn(['dummy', 'page'])
  kind!: 'dummy' | 'page';

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsNumber()
  value?: number;

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
}

class GraphNodeDto {
  @IsString()
  id!: string;

  @IsIn(['dummy', 'page'])
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
