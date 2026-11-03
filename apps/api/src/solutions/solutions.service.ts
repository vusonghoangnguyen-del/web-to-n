import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Not, Repository } from 'typeorm';
import { PublicUser } from '../auth/auth.types';
import { ProblemEntity, ProblemStatus } from '../database/entities/problem.entity';
import { SolutionRevisionEntity } from '../database/entities/solution-revision.entity';
import { SolutionEntity, SolutionStatus } from '../database/entities/solution.entity';
import { UserRole } from '../database/entities/user.entity';
import { CreateSolutionDto } from './dto/create-solution.dto';
import { ListSolutionsDto } from './dto/list-solutions.dto';
import { ModerationSolutionsDto } from './dto/moderation-solutions.dto';
import { ReviewSolutionDto } from './dto/review-solution.dto';
import { UpdateSolutionDto } from './dto/update-solution.dto';

@Injectable()
export class SolutionsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(SolutionEntity)
    private readonly solutions: Repository<SolutionEntity>,
    @InjectRepository(SolutionRevisionEntity)
    private readonly revisions: Repository<SolutionRevisionEntity>,
    @InjectRepository(ProblemEntity)
    private readonly problems: Repository<ProblemEntity>,
  ) {}

  async publicForProblem(problemId: string, query: ListSolutionsDto) {
    await this.requirePublishedProblem(problemId);
    const [rows, total] = await this.solutions.findAndCount({
      where: { problemId, status: SolutionStatus.Verified },
      relations: { author: true },
      order: { isFeatured: 'DESC', featuredAt: 'DESC', createdAt: 'ASC', id: 'ASC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return this.page(rows.map((solution) => this.toView(solution)), total, query.page, query.limit);
  }

  async mineForProblem(problemId: string, user: PublicUser) {
    const rows = await this.solutions.find({
      where: { problemId, authorId: user.id, status: Not(SolutionStatus.Withdrawn) },
      relations: { author: true, problem: true },
      order: { createdAt: 'DESC' },
    });
    return { solutions: rows.map((solution) => this.toView(solution, true)) };
  }

  async mine(user: PublicUser, query: ListSolutionsDto) {
    const [rows, total] = await this.solutions.findAndCount({
      where: { authorId: user.id, status: Not(SolutionStatus.Withdrawn) },
      relations: { author: true, problem: true },
      order: { updatedAt: 'DESC', id: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return this.page(rows.map((solution) => this.toView(solution, true)), total, query.page, query.limit);
  }

  async moderation(query: ModerationSolutionsDto) {
    const builder = this.solutions
      .createQueryBuilder('solution')
      .innerJoinAndSelect('solution.author', 'author')
      .innerJoinAndSelect('solution.problem', 'problem')
      .where('solution.status != :withdrawn', { withdrawn: SolutionStatus.Withdrawn });
    if (query.status !== 'all') builder.andWhere('solution.status = :status', { status: query.status });
    builder
      .addSelect(
        `CASE solution.status WHEN 'pending' THEN 1 WHEN 'verified' THEN 2 WHEN 'rejected' THEN 3 ELSE 4 END`,
        'status_rank',
      )
      .orderBy('status_rank', 'ASC')
      .addOrderBy('solution.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);
    const [rows, total] = await builder.getManyAndCount();
    return this.page(rows.map((solution) => this.toView(solution, true, true)), total, query.page, query.limit);
  }

  async create(problemId: string, user: PublicUser, dto: CreateSolutionDto) {
    return this.dataSource.transaction(async (manager) => {
      await this.requirePublishedProblem(problemId, manager);
      const repository = manager.getRepository(SolutionEntity);
      const pending = await repository.findOneBy({
        problemId,
        authorId: user.id,
        status: SolutionStatus.Pending,
      });
      if (pending) throw new ConflictException('Bạn đã có một lời giải đang chờ duyệt cho bài này.');
      const solution = await repository.save(repository.create({
        problemId,
        authorId: user.id,
        content: dto.content.trim(),
        status: SolutionStatus.Pending,
        editedAt: null,
        withdrawnAt: null,
        reviewedAt: null,
        reviewedBy: null,
        reviewNote: null,
        isFeatured: false,
        featuredAt: null,
        featuredBy: null,
      }));
      await this.saveRevision(manager, solution, user.id, 'Gửi lời giải');
      solution.author = this.userFromSession(user);
      return { solution: this.toView(solution) };
    });
  }

  async update(solutionId: string, user: PublicUser, dto: UpdateSolutionDto) {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(SolutionEntity);
      const solution = await repository.findOne({ where: { id: solutionId }, relations: { author: true } });
      if (!solution || solution.status === SolutionStatus.Withdrawn) {
        throw new NotFoundException('Không tìm thấy lời giải.');
      }
      if (solution.authorId !== user.id) throw new ForbiddenException('Bạn chỉ có thể sửa lời giải của chính mình.');
      solution.content = dto.content.trim();
      solution.status = SolutionStatus.Pending;
      solution.editedAt = new Date();
      solution.reviewedAt = null;
      solution.reviewedBy = null;
      solution.reviewNote = null;
      solution.isFeatured = false;
      solution.featuredAt = null;
      solution.featuredBy = null;
      await repository.save(solution);
      await this.saveRevision(manager, solution, user.id, dto.changeSummary?.trim() || 'Sửa và gửi duyệt lại lời giải');
      return { solution: this.toView(solution) };
    });
  }

  async withdraw(solutionId: string, user: PublicUser): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(SolutionEntity);
      const solution = await repository.findOneBy({ id: solutionId });
      if (!solution || solution.status === SolutionStatus.Withdrawn) {
        throw new NotFoundException('Không tìm thấy lời giải.');
      }
      if (solution.authorId !== user.id && !this.isModerator(user)) {
        throw new ForbiddenException('Bạn không có quyền rút lời giải này.');
      }
      solution.status = SolutionStatus.Withdrawn;
      solution.withdrawnAt = new Date();
      solution.isFeatured = false;
      solution.featuredAt = null;
      solution.featuredBy = null;
      await repository.save(solution);
      await this.saveRevision(manager, solution, user.id, 'Rút lời giải');
    });
  }

  async review(solutionId: string, reviewer: PublicUser, dto: ReviewSolutionDto) {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(SolutionEntity);
      const solution = await repository.findOne({ where: { id: solutionId }, relations: { author: true, problem: true } });
      if (!solution || solution.status === SolutionStatus.Withdrawn) {
        throw new NotFoundException('Không tìm thấy lời giải.');
      }
      const previousStatus = solution.status;
      if (dto.status === SolutionStatus.Rejected && !dto.reviewNote?.trim()) {
        throw new BadRequestException('Cần nhập lý do từ chối lời giải.');
      }
      solution.status = dto.status;
      solution.reviewedAt = dto.status === SolutionStatus.Pending ? null : new Date();
      solution.reviewedBy = dto.status === SolutionStatus.Pending ? null : reviewer.id;
      solution.reviewNote = dto.status === SolutionStatus.Pending ? null : dto.reviewNote?.trim() || null;
      if (dto.status !== SolutionStatus.Verified) {
        solution.isFeatured = false;
        solution.featuredAt = null;
        solution.featuredBy = null;
      }
      await repository.save(solution);
      await this.saveRevision(manager, solution, reviewer.id, `Kiểm duyệt: ${dto.status}`);
      await manager.query(
        `INSERT INTO audit_logs (actor_id, action, target_type, target_id, details) VALUES (?, 'solution.review', 'solution', ?, ?)`,
        [reviewer.id, solution.id, JSON.stringify({ previousStatus, status: dto.status, note: solution.reviewNote })],
      );
      if (dto.status === SolutionStatus.Verified && previousStatus !== SolutionStatus.Verified) {
        await manager.query(
          `INSERT INTO notifications (user_id, actor_id, problem_id, type, message)
           SELECT follow.user_id, ?, ?, 'verified_solution',
                  CONCAT('Có lời giải mới được kiểm chứng trong bài “', LEFT(problem.title, 205), '”.')
             FROM problem_follows follow
             JOIN problems problem ON problem.id = follow.problem_id
            WHERE follow.problem_id = ? AND follow.user_id != ?`,
          [solution.authorId, solution.problemId, solution.problemId, solution.authorId],
        );
      }
      return { solution: this.toView(solution, true, true) };
    });
  }

  async feature(solutionId: string, reviewer: PublicUser, featured: boolean) {
    const solution = await this.solutions.findOne({
      where: { id: solutionId },
      relations: { author: true, problem: true },
    });
    if (!solution || solution.status === SolutionStatus.Withdrawn) {
      throw new NotFoundException('Không tìm thấy lời giải.');
    }
    if (featured && solution.status !== SolutionStatus.Verified) {
      throw new BadRequestException('Chỉ lời giải đã kiểm chứng mới có thể được đánh dấu nổi bật.');
    }
    solution.isFeatured = featured;
    solution.featuredAt = featured ? new Date() : null;
    solution.featuredBy = featured ? reviewer.id : null;
    await this.solutions.save(solution);
    await this.dataSource.query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id, details) VALUES (?, 'solution.feature', 'solution', ?, ?)`,
      [reviewer.id, solution.id, JSON.stringify({ featured })],
    );
    return { solution: this.toView(solution, true, true) };
  }

  async history(solutionId: string, user: PublicUser) {
    const solution = await this.solutions.findOneBy({ id: solutionId });
    if (!solution) throw new NotFoundException('Không tìm thấy lời giải.');
    if (solution.authorId !== user.id && !this.isModerator(user)) {
      throw new ForbiddenException('Bạn không có quyền xem lịch sử lời giải này.');
    }
    const rows = await this.revisions.find({
      where: { solutionId },
      relations: { editor: true },
      order: { version: 'DESC' },
    });
    return {
      revisions: rows.map((revision) => ({
        id: revision.id,
        version: revision.version,
        content: revision.content,
        status: revision.status,
        changeSummary: revision.changeSummary,
        createdAt: revision.createdAt,
        editor: { id: revision.editor.id, username: revision.editor.username, name: revision.editor.name },
      })),
    };
  }

  private async requirePublishedProblem(problemId: string, manager?: EntityManager): Promise<void> {
    const repository = manager ? manager.getRepository(ProblemEntity) : this.problems;
    const problem = await repository.findOneBy({
      id: problemId,
      status: ProblemStatus.Published,
      deletedAt: IsNull(),
    });
    if (!problem) throw new NotFoundException('Bài toán chưa được xuất bản hoặc không tồn tại.');
  }

  private async saveRevision(
    manager: EntityManager,
    solution: SolutionEntity,
    editorId: string,
    changeSummary: string,
  ): Promise<void> {
    const repository = manager.getRepository(SolutionRevisionEntity);
    const latest = await repository
      .createQueryBuilder('revision')
      .select('COALESCE(MAX(revision.version), 0)', 'version')
      .where('revision.solutionId = :solutionId', { solutionId: solution.id })
      .getRawOne<{ version: string | number }>();
    await repository.save(repository.create({
      solutionId: solution.id,
      editorId,
      version: Number(latest?.version ?? 0) + 1,
      content: solution.content,
      status: solution.status,
      changeSummary,
    }));
  }

  private toView(solution: SolutionEntity, includeProblem = false, includeEmail = false) {
    return {
      id: String(solution.id),
      problemId: String(solution.problemId),
      content: solution.content,
      status: solution.status,
      edited: solution.editedAt !== null,
      reviewNote: solution.reviewNote,
      isFeatured: Boolean(solution.isFeatured),
      createdAt: solution.createdAt,
      updatedAt: solution.updatedAt,
      author: {
        id: String(solution.author.id),
        username: solution.author.username,
        name: solution.author.name,
        role: solution.author.role,
        ...(includeEmail ? { email: solution.author.email } : {}),
      },
      ...(includeProblem && solution.problem ? {
        problem: {
          id: String(solution.problem.id),
          slug: solution.problem.slug,
          title: solution.problem.title,
          status: solution.problem.status,
        },
      } : {}),
    };
  }

  private userFromSession(user: PublicUser): SolutionEntity['author'] {
    return { id: user.id, username: user.username, name: user.name, role: user.role } as SolutionEntity['author'];
  }

  private page<T>(rows: T[], total: number, page: number, limit: number) {
    return { solutions: rows, page, limit, total, totalPages: Math.ceil(total / limit), hasMore: page * limit < total };
  }

  private isModerator(user: PublicUser): boolean {
    return user.role === UserRole.Moderator || user.role === UserRole.Admin;
  }
}
