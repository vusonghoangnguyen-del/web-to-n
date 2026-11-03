import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { CommentEntity } from '../database/entities/comment.entity';
import { ProblemRevisionEntity } from '../database/entities/problem-revision.entity';
import { ProblemEntity } from '../database/entities/problem.entity';
import { ProblemsController } from './problems.controller';
import { ProblemsService } from './problems.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProblemEntity, ProblemRevisionEntity, CommentEntity]),
    AuthModule,
  ],
  controllers: [ProblemsController],
  providers: [ProblemsService],
})
export class ProblemsModule {}
