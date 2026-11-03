import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { SolutionStatus } from '../../database/entities/solution.entity';

export class ReviewSolutionDto {
  @ApiProperty({ enum: [SolutionStatus.Pending, SolutionStatus.Verified, SolutionStatus.Rejected] })
  @IsIn([SolutionStatus.Pending, SolutionStatus.Verified, SolutionStatus.Rejected])
  status!: SolutionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNote?: string;
}
