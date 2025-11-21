import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @MinLength(3)
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;
}
