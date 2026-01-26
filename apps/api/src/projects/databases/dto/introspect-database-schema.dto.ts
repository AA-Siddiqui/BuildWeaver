import { Type } from 'class-transformer';
import { IsDefined, IsOptional, IsString, ValidateNested } from 'class-validator';
import { DatabaseConnectionDto } from '../../graph/dto/database-schema.dto';

export class IntrospectDatabaseSchemaDto {
  @IsOptional()
  @IsString()
  schemaId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => DatabaseConnectionDto)
  connection!: DatabaseConnectionDto;
}
