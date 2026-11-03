import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { PublicUser } from '../auth/auth.types';
import { BookmarkEntity } from '../database/entities/bookmark.entity';
import { NotificationEntity } from '../database/entities/notification.entity';
import { ProblemFollowEntity } from '../database/entities/problem-follow.entity';
import { ProblemReactionEntity } from '../database/entities/problem-reaction.entity';
import { ProblemEntity, ProblemStatus } from '../database/entities/problem.entity';
import { SolutionReactionEntity } from '../database/entities/solution-reaction.entity';
import { SolutionEntity, SolutionStatus } from '../database/entities/solution.entity';

@Injectable()
export class EngagementService {
  constructor(
    @InjectRepository(BookmarkEntity) private readonly bookmarks: Repository<BookmarkEntity>,
    @InjectRepository(NotificationEntity) private readonly notifications: Repository<NotificationEntity>,
    @InjectRepository(ProblemFollowEntity) private readonly follows: Repository<ProblemFollowEntity>,
    @InjectRepository(ProblemReactionEntity) private readonly problemReactions: Repository<ProblemReactionEntity>,
    @InjectRepository(SolutionReactionEntity) private readonly solutionReactions: Repository<SolutionReactionEntity>,
    @InjectRepository(ProblemEntity) private readonly problems: Repository<ProblemEntity>,
    @InjectRepository(SolutionEntity) private readonly solutions: Repository<SolutionEntity>,
  ) {}

  async listBookmarks(user: PublicUser) {
    const rows = await this.bookmarks.find({
      where: { userId: user.id, problem: { status: ProblemStatus.Published, deletedAt: IsNull() } },
      relations: { problem: { author: true, categoryLinks: { category: true } } },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return { bookmarks: rows.map((row) => this.problemView(row.problem, row.createdAt)) };
  }

  async setBookmark(problemId: string, user: PublicUser, saved: boolean) {
    await this.requirePublishedProblem(problemId);
    if (saved) {
      await this.bookmarks.createQueryBuilder().insert().values({ userId: user.id, problemId }).orIgnore().execute();
    } else {
      await this.bookmarks.delete({ userId: user.id, problemId });
    }
    return { bookmarked: saved };
  }

  async listFollows(user: PublicUser) {
    const rows = await this.follows.find({
      where: { userId: user.id, problem: { status: ProblemStatus.Published, deletedAt: IsNull() } },
      relations: { problem: { author: true, categoryLinks: { category: true } } },
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return { follows: rows.map((row) => this.problemView(row.problem, row.createdAt)) };
  }

  async listNotifications(user: PublicUser) {
    const rows = await this.notifications.find({
      where: { userId: user.id },
      relations: { problem: true, actor: true },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    return {
      unreadCount: rows.filter((row) => !row.readAt).length,
      notifications: rows.map((row) => ({
        id: String(row.id),
        type: row.type,
        message: row.message,
        read: Boolean(row.readAt),
        createdAt: row.createdAt,
        problem: { id: String(row.problem.id), title: row.problem.title },
        actor: row.actor ? { id: String(row.actor.id), name: row.actor.name } : null,
      })),
    };
  }

  async readNotifications(user: PublicUser) {
    await this.notifications.createQueryBuilder()
      .update()
      .set({ readAt: () => 'CURRENT_TIMESTAMP' })
      .where('user_id = :userId AND read_at IS NULL', { userId: user.id })
      .execute();
    return { unreadCount: 0 };
  }

  async setFollow(problemId: string, user: PublicUser, followed: boolean) {
    await this.requirePublishedProblem(problemId);
    if (followed) {
      await this.follows.createQueryBuilder().insert().values({ userId: user.id, problemId }).orIgnore().execute();
    } else {
      await this.follows.delete({ userId: user.id, problemId });
    }
    return { followed, followerCount: await this.follows.countBy({ problemId }) };
  }

  async setProblemReaction(problemId: string, user: PublicUser, liked: boolean) {
    await this.requirePublishedProblem(problemId);
    if (liked) {
      await this.problemReactions.createQueryBuilder().insert().values({ userId: user.id, problemId }).orIgnore().execute();
    } else {
      await this.problemReactions.delete({ userId: user.id, problemId });
    }
    return { liked, reactionCount: await this.problemReactions.countBy({ problemId }) };
  }

  async setSolutionReaction(solutionId: string, user: PublicUser, liked: boolean) {
    const solution = await this.requireVerifiedSolution(solutionId);
    if (liked) {
      await this.solutionReactions.createQueryBuilder().insert().values({ userId: user.id, solutionId }).orIgnore().execute();
    } else {
      await this.solutionReactions.delete({ userId: user.id, solutionId });
    }
    return {
      liked,
      problemId: String(solution.problemId),
      reactionCount: await this.solutionReactions.countBy({ solutionId }),
    };
  }

  async summary(problemId: string) {
    await this.requirePublishedProblem(problemId);
    const solutions = await this.solutions.find({
      select: { id: true },
      where: { problemId, status: SolutionStatus.Verified },
    });
    const solutionIds = solutions.map((solution) => solution.id);
    const reactionRows = solutionIds.length
      ? await this.solutionReactions
          .createQueryBuilder('reaction')
          .select('reaction.solutionId', 'solutionId')
          .addSelect('COUNT(*)', 'count')
          .where('reaction.solutionId IN (:...solutionIds)', { solutionIds })
          .groupBy('reaction.solutionId')
          .getRawMany<{ solutionId: string; count: string }>()
      : [];
    return {
      problemId: String(problemId),
      reactionCount: await this.problemReactions.countBy({ problemId }),
      followerCount: await this.follows.countBy({ problemId }),
      solutionReactions: Object.fromEntries(reactionRows.map((row) => [String(row.solutionId), Number(row.count)])),
    };
  }

  async mine(problemId: string, user: PublicUser) {
    await this.requirePublishedProblem(problemId);
    const solutionRows = await this.solutionReactions
      .createQueryBuilder('reaction')
      .innerJoin('reaction.solution', 'solution')
      .select('reaction.solutionId', 'solutionId')
      .where('reaction.userId = :userId', { userId: user.id })
      .andWhere('solution.problemId = :problemId', { problemId })
      .andWhere('solution.status = :status', { status: SolutionStatus.Verified })
      .getRawMany<{ solutionId: string }>();
    const [bookmarked, followed, problemLiked] = await Promise.all([
      this.bookmarks.exists({ where: { userId: user.id, problemId } }),
      this.follows.exists({ where: { userId: user.id, problemId } }),
      this.problemReactions.exists({ where: { userId: user.id, problemId } }),
    ]);
    return {
      bookmarked,
      followed,
      problemLiked,
      likedSolutionIds: solutionRows.map((row) => String(row.solutionId)),
    };
  }

  private async requirePublishedProblem(problemId: string): Promise<ProblemEntity> {
    const problem = await this.problems.findOneBy({
      id: problemId,
      status: ProblemStatus.Published,
      deletedAt: IsNull(),
    });
    if (!problem) throw new NotFoundException('Bài toán chưa được xuất bản hoặc không tồn tại.');
    return problem;
  }

  private async requireVerifiedSolution(solutionId: string): Promise<SolutionEntity> {
    const solution = await this.solutions.findOne({
      where: { id: solutionId, status: SolutionStatus.Verified },
      relations: { problem: true },
    });
    if (!solution || solution.problem.status !== ProblemStatus.Published || solution.problem.deletedAt) {
      throw new NotFoundException('Lời giải chưa được kiểm chứng hoặc không tồn tại.');
    }
    return solution;
  }

  private problemView(problem: ProblemEntity, savedAt: Date) {
    return {
      id: String(problem.id),
      slug: problem.slug,
      title: problem.title,
      body: problem.content,
      difficulty: problem.difficulty,
      publishedAt: problem.publishedAt,
      savedAt,
      author: { id: String(problem.author.id), username: problem.author.username, name: problem.author.name },
      categories: problem.categoryLinks.map((link) => ({ name: link.category.name, slug: link.category.slug })),
    };
  }
}
