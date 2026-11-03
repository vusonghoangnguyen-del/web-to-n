import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { AuditLogEntity } from '../database/entities/audit-log.entity';
import { CommentReportEntity } from '../database/entities/comment-report.entity';
import { CommentEntity } from '../database/entities/comment.entity';
import { ProblemEntity } from '../database/entities/problem.entity';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProblemEntity, CommentEntity, CommentReportEntity, AuditLogEntity]), AuthModule],
  controllers: [ModerationController], providers: [ModerationService],
})
export class ModerationModule {}
