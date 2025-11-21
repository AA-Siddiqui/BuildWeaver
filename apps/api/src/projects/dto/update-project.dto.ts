import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateProjectDto {
  @IsString()
  @MinLength(3)
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
