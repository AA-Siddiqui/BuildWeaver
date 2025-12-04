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
  @IsIn(['string', 'number', 'boolean', 'object', 'list'])
  dataType?: PageDynamicInput['dataType'];

  @ValidateIf((input) => input.dataType === 'list')
  @IsOptional()
  @IsIn(['string', 'number', 'boolean', 'object'])
  listItemType?: PageDynamicInput['listItemType'];

  @ValidateIf((input) => input.dataType === 'object' || input.listItemType === 'object')
  @IsOptional()
  @IsObject()
  objectSample?: Record<string, ScalarValue>;
}
