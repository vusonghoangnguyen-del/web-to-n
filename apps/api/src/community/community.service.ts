import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NewsletterSubscriptionEntity } from '../database/entities/newsletter-subscription.entity';
import { ProblemStatus } from '../database/entities/problem.entity';
import { SolutionEntity, SolutionStatus } from '../database/entities/solution.entity';
import { VideoEntity, VideoStatus } from '../database/entities/video.entity';

@Injectable()
export class CommunityService {
  constructor(
    @InjectRepository(VideoEntity) private readonly videoRepository: Repository<VideoEntity>,
    @InjectRepository(SolutionEntity) private readonly solutionRepository: Repository<SolutionEntity>,
    @InjectRepository(NewsletterSubscriptionEntity)
    private readonly newsletterRepository: Repository<NewsletterSubscriptionEntity>,
  ) {}

  async videos() {
    const rows = await this.videoRepository.find({
      where: { status: VideoStatus.Published },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: 30,
    });
    return {
      videos: rows.map((video) => ({
        id: video.id,
        title: video.title,
        topic: video.topic,
        duration: video.duration,
        url: video.url,
      })),
    };
  }

  async featuredSolutions() {
    const rows = await this.solutionRepository
      .createQueryBuilder('solution')
      .innerJoinAndSelect('solution.problem', 'problem')
      .innerJoinAndSelect('solution.author', 'author')
      .where('solution.status = :status', { status: SolutionStatus.Verified })
      .andWhere('solution.isFeatured = :featured', { featured: true })
      .andWhere('problem.status = :problemStatus', { problemStatus: ProblemStatus.Published })
      .andWhere('problem.deletedAt IS NULL')
      .orderBy('solution.featuredAt', 'DESC')
      .addOrderBy('solution.id', 'DESC')
      .take(4)
      .getMany();
    return {
      solutions: rows.map((solution) => ({
        id: solution.id,
        problem_id: solution.problem.id,
        problem_title: solution.problem.title,
        problem_slug: solution.problem.slug,
        author_name: solution.author.name,
        excerpt: solution.content.replace(/\s+/g, ' ').trim().slice(0, 180),
      })),
    };
  }

  async subscribe(value: unknown) {
    const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Email không hợp lệ.');
    }
    await this.newsletterRepository
      .createQueryBuilder()
      .insert()
      .values({ email })
      .orIgnore()
      .execute();
    return { message: 'Đã ghi nhận email đăng ký.' };
  }
}
