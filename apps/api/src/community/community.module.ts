import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NewsletterSubscriptionEntity } from '../database/entities/newsletter-subscription.entity';
import { SolutionEntity } from '../database/entities/solution.entity';
import { VideoEntity } from '../database/entities/video.entity';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';

@Module({
  imports: [TypeOrmModule.forFeature([VideoEntity, SolutionEntity, NewsletterSubscriptionEntity])],
  controllers: [CommunityController],
  providers: [CommunityService],
})
export class CommunityModule {}
