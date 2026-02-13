import { IsString, MaxLength, MinLength } from 'class-validator';

export class GenerateLogicDto {
  @IsString()
  @MinLength(3, { message: 'Prompt must be at least 3 characters' })
  @MaxLength(2000, { message: 'Prompt must be at most 2000 characters' })
  prompt!: string;
}
