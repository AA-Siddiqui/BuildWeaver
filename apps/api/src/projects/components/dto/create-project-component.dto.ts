import { BuilderComponentDefinition, ComponentBindingReference } from '@buildweaver/libs';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

export class ComponentBindingReferenceDto implements ComponentBindingReference {
  @IsString()
  @IsNotEmpty()
  bindingId!: string;

  @IsOptional()
  @IsArray()
  @Type(() => String)
  propertyPath?: string[];

  @IsOptional()
  @IsString()
  componentId?: string;

  @IsOptional()
  @IsString()
  componentType?: string;

  @IsOptional()
  @IsBoolean()
  exposeAsParameter?: boolean;
}

export class CreateProjectComponentDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsObject()
  definition?: BuilderComponentDefinition;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComponentBindingReferenceDto)
  bindingReferences?: ComponentBindingReferenceDto[];
}
