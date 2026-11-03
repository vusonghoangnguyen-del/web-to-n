import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CommentReportReason } from '../../database/entities/comment-report.entity';

export class ReportCommentDto {
  @ApiProperty({ enum: CommentReportReason })
  @IsEnum(CommentReportReason)
  reason!: CommentReportReason;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  details?: string;
}
