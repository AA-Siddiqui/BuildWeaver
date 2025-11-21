import { PageBuilderState } from '@buildweaver/libs';
import { Type } from 'class-transformer';
import { IsArray, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { PageDynamicInputDto } from './page-dynamic-input.dto';

export class UpdateProjectPageDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsObject()
  builderState?: PageBuilderState;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PageDynamicInputDto)
  dynamicInputs?: PageDynamicInputDto[];
}
