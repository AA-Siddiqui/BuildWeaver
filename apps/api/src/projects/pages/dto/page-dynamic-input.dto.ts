import { PageDynamicInput, ScalarValue } from '@buildweaver/libs';
import { IsIn, IsObject, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';

export class PageDynamicInputDto implements Partial<PageDynamicInput> {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  label!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['string', 'number', 'boolean', 'object'])
  dataType?: PageDynamicInput['dataType'];

  @ValidateIf((input) => input.dataType === 'object')
  @IsOptional()
  @IsObject()
  objectSample?: Record<string, ScalarValue>;
}
