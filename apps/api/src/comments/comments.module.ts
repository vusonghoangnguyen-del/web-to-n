import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CommentReportEntity } from '../database/entities/comment-report.entity';
import { CommentEntity } from '../database/entities/comment.entity';
import { ProblemEntity } from '../database/entities/problem.entity';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CommentEntity, CommentReportEntity, ProblemEntity]),
    AuthModule,
  ],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
