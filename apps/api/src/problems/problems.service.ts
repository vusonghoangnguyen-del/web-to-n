import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { PublicUser } from '../auth/auth.types';
import { CategoryEntity } from '../database/entities/category.entity';
import { CommentEntity, CommentStatus } from '../database/entities/comment.entity';
import { ProblemCategoryEntity } from '../database/entities/problem-category.entity';
import { ProblemRevisionEntity } from '../database/entities/problem-revision.entity';
import { ProblemEntity, ProblemStatus } from '../database/entities/problem.entity';
import { UserRole } from '../database/entities/user.entity';
import { CreateProblemDto } from './dto/create-problem.dto';
import { ListProblemsDto } from './dto/list-problems.dto';
import { UpdateProblemDto } from './dto/update-problem.dto';
import { toSlugBase } from './problem-slug';

type ProblemView = {
  id: string;
  slug: string;
  title: string;
  body: string;
  source: string | null;
  difficulty: string;
  status: ProblemStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  author: { id: string; username: string; name: string };
  categories: Array<{ name: string; slug: string }>;
  commentCount: number;
};

@Injectable()
export class ProblemsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ProblemEntity)
    private readonly problems: Repository<ProblemEntity>,
    @InjectRepository(CommentEntity)
    private readonly comments: Repository<CommentEntity>,
    @InjectRepository(ProblemRevisionEntity)
    private readonly revisions: Repository<ProblemRevisionEntity>,
  ) {}

  async list(query: ListProblemsDto): Promise<{
    problems: ProblemView[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  }> {
    const builder = this.baseListQuery()
      .andWhere('problem.status = :status', { status: ProblemStatus.Published });
    this.applyFilters(builder, query);
    builder
      .orderBy('problem.publishedAt', 'DESC')
      .addOrderBy('problem.id', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [rows, total] = await builder.getManyAndCount();
    const counts = await this.commentCounts(rows.map((problem) => problem.id));
    return {
      problems: rows.map((problem) => this.toView(problem, counts.get(problem.id) ?? 0)),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
      hasMore: query.page * query.limit < total,
    };
  }

  async mine(user: PublicUser, query: ListProblemsDto): Promise<{
    problems: ProblemView[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  }> {
    const builder = this.baseListQuery().andWhere('problem.authorId = :authorId', {
      authorId: user.id,
    });
    this.applyFilters(builder, query);
    builder
      .orderBy('problem.updatedAt', 'DESC')
      .addOrderBy('problem.id', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);
    const [rows, total] = await builder.getManyAndCount();
    const counts = await this.commentCounts(rows.map((problem) => problem.id));
    return {
      problems: rows.map((problem) => this.toView(problem, counts.get(problem.id) ?? 0)),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
      hasMore: query.page * query.limit < total,
    };
  }

  async detail(identifier: string): Promise<{ problem: ProblemView }> {
    const problem = await this.findByIdentifier(identifier, true);
    const counts = await this.commentCounts([problem.id]);
    return { problem: this.toView(problem, counts.get(problem.id) ?? 0) };
  }

  async create(user: PublicUser, dto: CreateProblemDto): Promise<{ problem: ProblemView }> {
    return this.dataSource.transaction(async (manager) => {
      const categories = await this.resolveCategories(manager, dto.categorySlugs);
      const repository = manager.getRepository(ProblemEntity);
      const problem = repository.create({
        authorId: user.id,
        title: dto.title.trim(),
        slug: await this.uniqueSlug(manager, dto.title),
        content: dto.body.trim(),
        source: dto.source?.trim() || null,
        difficulty: dto.difficulty,
        status: dto.status,
        publishedAt: null,
        deletedAt: null,
      });
      await repository.save(problem);
      await this.replaceCategories(manager, problem.id, categories);
      await this.saveRevision(manager, problem, user.id, categories, 'Tạo bài toán');
      const saved = await this.findWithRelations(manager, problem.id);
      return { problem: this.toView(saved, 0) };
    });
  }

  async update(
    identifier: string,
    user: PublicUser,
    dto: UpdateProblemDto,
  ): Promise<{ problem: ProblemView }> {
    return this.dataSource.transaction(async (manager) => {
      const problem = await this.findEditable(manager, identifier);
      const elevated = this.isModerator(user);
      if (problem.authorId !== user.id && !elevated) {
        throw new ForbiddenException('Bạn không có quyền sửa bài toán này.');
      }
      if (problem.status === ProblemStatus.Published && !elevated) {
        throw new ForbiddenException('Bài đã xuất bản chỉ có thể được sửa bởi moderator hoặc admin.');
      }
      if (
        dto.status &&
        !elevated &&
        ![ProblemStatus.Draft, ProblemStatus.Pending].includes(dto.status)
      ) {
        throw new ForbiddenException('Bạn không có quyền đặt trạng thái này.');
      }

      if (dto.title !== undefined && dto.title.trim() !== problem.title) {
        problem.title = dto.title.trim();
        problem.slug = await this.uniqueSlug(manager, problem.title, problem.id);
      }
      if (dto.body !== undefined) problem.content = dto.body.trim();
      if (dto.source !== undefined) problem.source = dto.source.trim() || null;
      if (dto.difficulty !== undefined) problem.difficulty = dto.difficulty;
      if (dto.status !== undefined) {
        problem.status = dto.status;
        problem.publishedAt = dto.status === ProblemStatus.Published
          ? problem.publishedAt ?? new Date()
          : null;
      }

      const categories = dto.categorySlugs
        ? await this.resolveCategories(manager, dto.categorySlugs)
        : problem.categoryLinks.map((link) => link.category);
      await manager.getRepository(ProblemEntity).save(problem);
      if (dto.categorySlugs) await this.replaceCategories(manager, problem.id, categories);
      await this.saveRevision(
        manager,
        problem,
        user.id,
        categories,
        dto.changeSummary?.trim() || 'Cập nhật bài toán',
      );
      const saved = await this.findWithRelations(manager, problem.id);
      const counts = await this.commentCounts([problem.id]);
      return { problem: this.toView(saved, counts.get(problem.id) ?? 0) };
    });
  }

  async softDelete(identifier: string, user: PublicUser): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const problem = await this.findEditable(manager, identifier);
      if (problem.authorId !== user.id && !this.isModerator(user)) {
        throw new ForbiddenException('Bạn không có quyền xóa bài toán này.');
      }
      problem.deletedAt = new Date();
      await manager.getRepository(ProblemEntity).save(problem);
      await this.saveRevision(
        manager,
        problem,
        user.id,
        problem.categoryLinks.map((link) => link.category),
        'Xóa mềm bài toán',
      );
    });
  }

  async history(identifier: string, user: PublicUser): Promise<{ revisions: unknown[] }> {
    const problem = await this.findByIdentifierForOwner(identifier);
    if (problem.authorId !== user.id && !this.isModerator(user)) {
      throw new ForbiddenException('Bạn không có quyền xem lịch sử bài toán này.');
    }
    const revisions = await this.revisions.find({
      where: { problemId: problem.id },
      relations: { editor: true },
      order: { version: 'DESC' },
    });
    return {
      revisions: revisions.map((revision) => ({
        id: revision.id,
        version: revision.version,
        title: revision.title,
        body: revision.content,
        source: revision.source,
        difficulty: revision.difficulty,
        status: revision.status,
        categorySlugs: revision.categorySlugs,
        changeSummary: revision.changeSummary,
        createdAt: revision.createdAt,
        editor: {
          id: revision.editor.id,
          username: revision.editor.username,
          name: revision.editor.name,
        },
      })),
    };
  }

  private baseListQuery() {
    return this.problems
      .createQueryBuilder('problem')
      .innerJoinAndSelect('problem.author', 'author')
      .leftJoinAndSelect('problem.categoryLinks', 'categoryLink')
      .leftJoinAndSelect('categoryLink.category', 'category')
      .where('problem.deletedAt IS NULL');
  }

  private applyFilters(builder: ReturnType<ProblemsService['baseListQuery']>, query: ListProblemsDto): void {
    const search = query.search?.trim();
    if (search) {
      const escaped = search.replace(/[\\%_]/g, (character) => `\\${character}`);
      builder.andWhere('(problem.title LIKE :search OR problem.content LIKE :search)', {
        search: `%${escaped}%`,
      });
    }
    if (query.category && query.category !== 'all') {
      builder.andWhere(
        `EXISTS (SELECT 1 FROM problem_categories filter_pc
          JOIN categories filter_category ON filter_category.id = filter_pc.category_id
         WHERE filter_pc.problem_id = problem.id AND filter_category.slug = :category)`,
        { category: query.category },
      );
    }
    if (query.difficulty) builder.andWhere('problem.difficulty = :difficulty', { difficulty: query.difficulty });
  }

  private async findByIdentifier(identifier: string, publicOnly: boolean): Promise<ProblemEntity> {
    const builder = this.baseListQuery();
    this.whereIdentifier(builder, identifier);
    if (publicOnly) builder.andWhere('problem.status = :status', { status: ProblemStatus.Published });
    const problem = await builder.getOne();
    if (!problem) throw new NotFoundException('Bài toán không tồn tại hoặc chưa được xuất bản.');
    return problem;
  }

  private async findByIdentifierForOwner(identifier: string): Promise<ProblemEntity> {
    const builder = this.baseListQuery();
    this.whereIdentifier(builder, identifier);
    const problem = await builder.getOne();
    if (!problem) throw new NotFoundException('Không tìm thấy bài toán.');
    return problem;
  }

  private async findEditable(manager: EntityManager, identifier: string): Promise<ProblemEntity> {
    const builder = manager
      .getRepository(ProblemEntity)
      .createQueryBuilder('problem')
      .innerJoinAndSelect('problem.author', 'author')
      .leftJoinAndSelect('problem.categoryLinks', 'categoryLink')
      .leftJoinAndSelect('categoryLink.category', 'category')
      .where('problem.deletedAt IS NULL');
    this.whereIdentifier(builder, identifier);
    const problem = await builder.getOne();
    if (!problem) throw new NotFoundException('Không tìm thấy bài toán.');
    return problem;
  }

  private whereIdentifier(builder: ReturnType<ProblemsService['baseListQuery']>, identifier: string): void {
    if (/^[1-9]\d*$/.test(identifier)) {
      builder.andWhere('problem.id = :id', { id: identifier });
    } else {
      builder.andWhere('problem.slug = :slug', { slug: identifier });
    }
  }

  private async resolveCategories(manager: EntityManager, slugs: string[]): Promise<CategoryEntity[]> {
    const unique = [...new Set(slugs.map((slug) => slug.trim()).filter(Boolean))];
    if (!unique.length) throw new BadRequestException('Cần chọn ít nhất một chuyên mục.');
    const categories = await manager.getRepository(CategoryEntity).findBy({ slug: In(unique) });
    if (categories.length !== unique.length) {
      throw new BadRequestException('Có chuyên mục không hợp lệ.');
    }
    return categories.sort((left, right) => left.slug.localeCompare(right.slug));
  }

  private async replaceCategories(
    manager: EntityManager,
    problemId: string,
    categories: CategoryEntity[],
  ): Promise<void> {
    const repository = manager.getRepository(ProblemCategoryEntity);
    await repository.delete({ problemId });
    await repository.save(
      categories.map((category) => repository.create({ problemId, categoryId: category.id })),
    );
  }

  private async uniqueSlug(manager: EntityManager, title: string, currentId?: string): Promise<string> {
    const base = toSlugBase(title);
    const repository = manager.getRepository(ProblemEntity);
    for (let suffix = 0; suffix < 1000; suffix += 1) {
      const slug = suffix === 0 ? base : `${base}-${suffix + 1}`;
      const existing = await repository.findOne({ where: { slug }, select: { id: true } });
      if (!existing || existing.id === currentId) return slug;
    }
    throw new BadRequestException('Không thể tạo đường dẫn duy nhất cho bài toán.');
  }

  private async saveRevision(
    manager: EntityManager,
    problem: ProblemEntity,
    editorId: string,
    categories: CategoryEntity[],
    changeSummary: string,
  ): Promise<void> {
    const repository = manager.getRepository(ProblemRevisionEntity);
    const latest = await repository
      .createQueryBuilder('revision')
      .select('COALESCE(MAX(revision.version), 0)', 'version')
      .where('revision.problemId = :problemId', { problemId: problem.id })
      .getRawOne<{ version: string | number }>();
    await repository.save(repository.create({
      problemId: problem.id,
      editorId,
      version: Number(latest?.version ?? 0) + 1,
      title: problem.title,
      content: problem.content,
      source: problem.source,
      difficulty: problem.difficulty,
      status: problem.status,
      categorySlugs: categories.map((category) => category.slug),
      changeSummary,
    }));
  }

  private async findWithRelations(manager: EntityManager, id: string): Promise<ProblemEntity> {
    const problem = await manager.getRepository(ProblemEntity).findOne({
      where: { id },
      relations: { author: true, categoryLinks: { category: true } },
    });
    if (!problem) throw new NotFoundException('Không tìm thấy bài toán.');
    return problem;
  }

  private async commentCounts(problemIds: string[]): Promise<Map<string, number>> {
    if (!problemIds.length) return new Map();
    const rows = await this.comments
      .createQueryBuilder('comment')
      .select('comment.problemId', 'problemId')
      .addSelect('COUNT(*)', 'total')
      .where('comment.problemId IN (:...problemIds)', { problemIds })
      .andWhere('comment.status = :status', { status: CommentStatus.Visible })
      .andWhere('comment.deletedAt IS NULL')
      .groupBy('comment.problemId')
      .getRawMany<{ problemId: string; total: string }>();
    return new Map(rows.map((row) => [String(row.problemId), Number(row.total)]));
  }

  private toView(problem: ProblemEntity, commentCount: number): ProblemView {
    return {
      id: String(problem.id),
      slug: problem.slug,
      title: problem.title,
      body: problem.content,
      source: problem.source,
      difficulty: problem.difficulty,
      status: problem.status,
      publishedAt: problem.publishedAt,
      createdAt: problem.createdAt,
      updatedAt: problem.updatedAt,
      author: {
        id: String(problem.author.id),
        username: problem.author.username,
        name: problem.author.name,
      },
      categories: (problem.categoryLinks ?? []).map((link) => ({
        name: link.category.name,
        slug: link.category.slug,
      })),
      commentCount,
    };
  }

  private isModerator(user: PublicUser): boolean {
    return user.role === UserRole.Moderator || user.role === UserRole.Admin;
  }
}
