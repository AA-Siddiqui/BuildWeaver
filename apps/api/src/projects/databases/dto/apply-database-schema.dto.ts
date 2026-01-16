import { Type } from 'class-transformer';
import { IsDefined, ValidateNested } from 'class-validator';
import { DatabaseConnectionDto, DatabaseSchemaDto } from '../../graph/dto/database-schema.dto';

export class ApplyDatabaseSchemaDto extends DatabaseSchemaDto {
  @IsDefined()
  @ValidateNested()
  @Type(() => DatabaseConnectionDto)
  declare connection: DatabaseConnectionDto;
}
