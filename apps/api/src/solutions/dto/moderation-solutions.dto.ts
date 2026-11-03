import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { SolutionStatus } from '../../database/entities/solution.entity';

export class ModerationSolutionsDto {
  @ApiPropertyOptional({ enum: ['all', SolutionStatus.Pending, SolutionStatus.Verified, SolutionStatus.Rejected] })
  @IsOptional()
  @Transform(({ value }) => value === '' ? undefined : value)
  @IsIn(['all', SolutionStatus.Pending, SolutionStatus.Verified, SolutionStatus.Rejected])
  status: 'all' | SolutionStatus = SolutionStatus.Pending;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 50, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}
