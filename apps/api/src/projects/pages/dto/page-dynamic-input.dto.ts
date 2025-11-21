import { PageDynamicInput } from '@buildweaver/libs';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

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
  @IsIn(['string', 'number', 'boolean'])
  dataType?: PageDynamicInput['dataType'];
}
