import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CheckSubdomainAvailabilityDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(63)
  @Matches(/^[a-zA-Z0-9-]+$/, {
    message:
      'Deployment name may only contain letters, numbers, and hyphens',
  })
  deploymentName!: string;
}
