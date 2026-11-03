import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { PublicUser } from '../auth/auth.types';
import { AuditLogEntity } from '../database/entities/audit-log.entity';
import { CommentReportEntity, CommentReportStatus } from '../database/entities/comment-report.entity';
import { CommentEntity, CommentStatus } from '../database/entities/comment.entity';
import { ProblemRevisionEntity } from '../database/entities/problem-revision.entity';
import { ProblemEntity, ProblemStatus } from '../database/entities/problem.entity';
import { SolutionEntity, SolutionStatus } from '../database/entities/solution.entity';
import { UserEntity } from '../database/entities/user.entity';
import { CommentVisibilityDto, ModerationListDto, ResolveReportDto, ReviewProblemDto } from './moderation.dto';

@Injectable()
export class ModerationService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ProblemEntity) private readonly problems: Repository<ProblemEntity>,
    @InjectRepository(CommentEntity) private readonly comments: Repository<CommentEntity>,
    @InjectRepository(CommentReportEntity) private readonly reports: Repository<CommentReportEntity>,
    @InjectRepository(AuditLogEntity) private readonly audits: Repository<AuditLogEntity>,
  ) {}

  async stats() {
    const [pendingProblems, publishedProblems, users, pendingSolutions, pendingReports] = await Promise.all([
      this.problems.countBy({ status: ProblemStatus.Pending, deletedAt: IsNull() }),
      this.problems.countBy({ status: ProblemStatus.Published, deletedAt: IsNull() }),
      this.dataSource.getRepository(UserEntity).count(),
      this.dataSource.getRepository(SolutionEntity).countBy({ status: SolutionStatus.Pending }),
      this.reports.countBy({ status: CommentReportStatus.Pending }),
    ]);
    return { stats: { pendingProblems, publishedProblems, users, pendingSolutions, pendingReports } };
  }

  async listProblems(query: ModerationListDto) {
    const builder = this.problems.createQueryBuilder('problem')
      .innerJoinAndSelect('problem.author', 'author')
      .leftJoinAndSelect('problem.categoryLinks', 'categoryLink')
      .leftJoinAndSelect('categoryLink.category', 'category')
      .where('problem.deletedAt IS NULL');
    if (query.status !== 'all') builder.andWhere('problem.status = :status', { status: query.status });
    const [rows, total] = await builder.orderBy('problem.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit).take(query.limit).getManyAndCount();
    return { problems: rows.map((problem) => ({
      id: String(problem.id), title: problem.title, content: problem.content, source: problem.source,
      difficulty: problem.difficulty, status: problem.status, createdAt: problem.createdAt,
      categories: problem.categoryLinks?.map((link) => link.category?.name).filter(Boolean).join(', ') || '',
      author: { id: String(problem.author.id), name: problem.author.name, email: problem.author.email },
    })), page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) };
  }

  async reviewProblem(id: string, actor: PublicUser, dto: ReviewProblemDto) {
    if (![ProblemStatus.Pending, ProblemStatus.Published, ProblemStatus.Rejected].includes(dto.status)) {
      throw new BadRequestException('Trạng thái kiểm duyệt bài toán không hợp lệ.');
    }
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(ProblemEntity);
      const problem = await repository.findOne({
        where: { id, deletedAt: IsNull() },
        relations: { author: true, categoryLinks: { category: true } },
      });
      if (!problem) throw new NotFoundException('Không tìm thấy bài toán.');
      const previousStatus = problem.status;
      problem.status = dto.status;
      problem.publishedAt = dto.status === ProblemStatus.Published ? (problem.publishedAt || new Date()) : null;
      await repository.save(problem);
      await this.saveProblemRevision(manager, problem, actor.id, dto.reviewNote?.trim() || `Kiểm duyệt: ${dto.status}`);
      await this.writeAudit(manager, actor.id, 'problem.review', 'problem', id, { previousStatus, status: dto.status, note: dto.reviewNote || null });
      return { problem: { id: String(problem.id), status: problem.status, publishedAt: problem.publishedAt } };
    });
  }

  async listComments(query: ModerationListDto) {
    const builder = this.comments.createQueryBuilder('comment')
      .innerJoinAndSelect('comment.user', 'user').innerJoinAndSelect('comment.problem', 'problem')
      .where('comment.deletedAt IS NULL');
    if (query.status !== 'all') builder.andWhere('comment.status = :status', { status: query.status });
    const [rows, total] = await builder.orderBy('comment.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit).take(query.limit).getManyAndCount();
    return { comments: rows.map((comment) => ({ id: String(comment.id), content: comment.content,
      status: comment.status, createdAt: comment.createdAt,
      author: { id: String(comment.user.id), name: comment.user.name, username: comment.user.username },
      problem: { id: String(comment.problem.id), title: comment.problem.title },
    })), page: query.page, limit: query.limit, total };
  }

  async setCommentVisibility(id: string, actor: PublicUser, dto: CommentVisibilityDto) {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(CommentEntity);
      const comment = await repository.findOneBy({ id, deletedAt: IsNull() });
      if (!comment) throw new NotFoundException('Không tìm thấy bình luận.');
      const previousStatus = comment.status;
      comment.status = dto.hidden ? CommentStatus.Hidden : CommentStatus.Visible;
      await repository.save(comment);
      await this.writeAudit(manager, actor.id, dto.hidden ? 'comment.hide' : 'comment.restore', 'comment', id, { previousStatus, status: comment.status });
      return { comment: { id: String(comment.id), status: comment.status } };
    });
  }

  async listReports(query: ModerationListDto) {
    const builder = this.reports.createQueryBuilder('report')
      .innerJoinAndSelect('report.reporter', 'reporter')
      .innerJoinAndSelect('report.comment', 'comment')
      .innerJoinAndSelect('comment.user', 'commentAuthor')
      .innerJoinAndSelect('comment.problem', 'problem')
      .leftJoinAndSelect('report.reviewer', 'reviewer');
    if (query.status !== 'all') builder.where('report.status = :status', { status: query.status });
    const [rows, total] = await builder.orderBy('report.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit).take(query.limit).getManyAndCount();
    return { reports: rows.map((report) => ({ id: String(report.id), reason: report.reason, details: report.details,
      status: report.status, resolutionNote: report.resolutionNote, createdAt: report.createdAt, reviewedAt: report.reviewedAt,
      reporter: { id: String(report.reporter.id), name: report.reporter.name },
      reviewer: report.reviewer ? { id: String(report.reviewer.id), name: report.reviewer.name } : null,
      comment: { id: String(report.comment.id), content: report.comment.content, status: report.comment.status,
        author: { id: String(report.comment.user.id), name: report.comment.user.name },
        problem: { id: String(report.comment.problem.id), title: report.comment.problem.title } },
    })), page: query.page, limit: query.limit, total };
  }

  async resolveReport(id: string, actor: PublicUser, dto: ResolveReportDto) {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(CommentReportEntity);
      const report = await repository.findOne({ where: { id }, relations: { comment: true } });
      if (!report) throw new NotFoundException('Không tìm thấy báo cáo.');
      report.status = dto.status;
      report.reviewedAt = new Date();
      report.reviewedBy = actor.id;
      report.resolutionNote = dto.resolutionNote?.trim() || null;
      if (dto.hideComment) {
        report.comment.status = CommentStatus.Hidden;
        await manager.getRepository(CommentEntity).save(report.comment);
      }
      await repository.save(report);
      await this.writeAudit(manager, actor.id, 'comment-report.resolve', 'comment_report', id, {
        status: dto.status, hideComment: dto.hideComment, commentId: report.commentId, note: report.resolutionNote,
      });
      return { report: { id: String(report.id), status: report.status, reviewedAt: report.reviewedAt } };
    });
  }

  async listAuditLogs(query: ModerationListDto) {
    const [rows, total] = await this.audits.findAndCount({ relations: { actor: true }, order: { createdAt: 'DESC', id: 'DESC' },
      skip: (query.page - 1) * query.limit, take: query.limit });
    return { auditLogs: rows.map((log) => ({ id: String(log.id), action: log.action, targetType: log.targetType,
      targetId: log.targetId, details: log.details, createdAt: log.createdAt,
      actor: log.actor ? { id: String(log.actor.id), name: log.actor.name, username: log.actor.username } : null,
    })), page: query.page, limit: query.limit, total };
  }

  private async saveProblemRevision(manager: EntityManager, problem: ProblemEntity, editorId: string, summary: string) {
    const repository = manager.getRepository(ProblemRevisionEntity);
    const latest = await repository.createQueryBuilder('revision').select('COALESCE(MAX(revision.version), 0)', 'version')
      .where('revision.problemId = :problemId', { problemId: problem.id }).getRawOne<{ version: string | number }>();
    await repository.save(repository.create({ problemId: problem.id, editorId, version: Number(latest?.version || 0) + 1,
      title: problem.title, content: problem.content, source: problem.source, difficulty: problem.difficulty,
      status: problem.status, categorySlugs: problem.categoryLinks?.map((link) => link.category.slug) || [], changeSummary: summary }));
  }

  private async writeAudit(manager: EntityManager, actorId: string, action: string, targetType: string, targetId: string, details: Record<string, unknown>) {
    const repository = manager.getRepository(AuditLogEntity);
    await repository.save(repository.create({ actorId, action, targetType, targetId, details }));
  }
}
