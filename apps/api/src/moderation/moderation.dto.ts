import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { CommentReportStatus } from '../database/entities/comment-report.entity';
import { ProblemStatus } from '../database/entities/problem.entity';

export class ModerationListDto {
  @IsOptional()
  @IsString()
  status = 'all';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}

export class ReviewProblemDto {
  @IsEnum(ProblemStatus)
  status!: ProblemStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewNote?: string;
}

export class CommentVisibilityDto {
  @IsBoolean()
  hidden!: boolean;
}

export class ResolveReportDto {
  @IsIn([CommentReportStatus.Reviewed, CommentReportStatus.Dismissed])
  status!: CommentReportStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  resolutionNote?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  hideComment = false;
}
