import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

class PositionDto {
  @IsNumber()
  x!: number;

  @IsNumber()
  y!: number;
}

export class DatabaseFieldDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsIn(['uuid', 'string', 'number', 'boolean', 'json', 'date', 'datetime'])
  type!: 'uuid' | 'string' | 'number' | 'boolean' | 'json' | 'date' | 'datetime';

  @IsBoolean()
  nullable!: boolean;

  @IsBoolean()
  unique!: boolean;

  @IsOptional()
  @IsBoolean()
  isId?: boolean;

  @IsOptional()
  @IsString()
  defaultValue?: string;
}

export class DatabaseTableDto {
  @IsString()
  id!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PositionDto)
  position?: PositionDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DatabaseFieldDto)
  fields!: DatabaseFieldDto[];
}

export class DatabaseRelationshipDto {
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

export class DatabaseConnectionDto {
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

export class DatabaseSchemaDto {
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
