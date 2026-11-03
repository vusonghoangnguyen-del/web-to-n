import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { BookmarkEntity } from '../database/entities/bookmark.entity';
import { NotificationEntity } from '../database/entities/notification.entity';
import { ProblemFollowEntity } from '../database/entities/problem-follow.entity';
import { ProblemReactionEntity } from '../database/entities/problem-reaction.entity';
import { ProblemEntity } from '../database/entities/problem.entity';
import { SolutionReactionEntity } from '../database/entities/solution-reaction.entity';
import { SolutionEntity } from '../database/entities/solution.entity';
import { EngagementController } from './engagement.controller';
import { EngagementService } from './engagement.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BookmarkEntity,
      NotificationEntity,
      ProblemFollowEntity,
      ProblemReactionEntity,
      SolutionReactionEntity,
      ProblemEntity,
      SolutionEntity,
    ]),
    AuthModule,
  ],
  controllers: [EngagementController],
  providers: [EngagementService],
})
export class EngagementModule {}
