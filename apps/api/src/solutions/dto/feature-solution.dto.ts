import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class FeatureSolutionDto {
  @ApiProperty()
  @IsBoolean()
  featured!: boolean;
}
