import { PageBuilderState } from '@buildweaver/libs';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { PageDynamicInputDto } from './page-dynamic-input.dto';

export class CreateProjectPageDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsObject()
  builderState?: PageBuilderState;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PageDynamicInputDto)
  dynamicInputs?: PageDynamicInputDto[];
}
