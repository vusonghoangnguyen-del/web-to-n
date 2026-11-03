import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, QueryFailedError, Repository } from 'typeorm';
import { PublicUser } from '../auth/auth.types';
import {
  CommentReportEntity,
  CommentReportStatus,
} from '../database/entities/comment-report.entity';
import { CommentEntity, CommentStatus } from '../database/entities/comment.entity';
import { ProblemEntity, ProblemStatus } from '../database/entities/problem.entity';
import { UserRole } from '../database/entities/user.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ListCommentsDto } from './dto/list-comments.dto';
import { ReportCommentDto } from './dto/report-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

type CommentView = {
  id: string;
  problemId: string;
  parentId: string | null;
  content: string;
  deleted: boolean;
  edited: boolean;
  createdAt: Date;
  updatedAt: Date;
  author: { id: string; username: string; name: string; role: string };
};

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(CommentEntity)
    private readonly comments: Repository<CommentEntity>,
    @InjectRepository(CommentReportEntity)
    private readonly reports: Repository<CommentReportEntity>,
    @InjectRepository(ProblemEntity)
    private readonly problems: Repository<ProblemEntity>,
  ) {}

  async list(problemId: string, query: ListCommentsDto): Promise<{
    comments: CommentView[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  }> {
    await this.requirePublishedProblem(problemId);
    const [rows, total] = await this.comments.findAndCount({
      where: { problemId, status: CommentStatus.Visible },
      relations: { user: true },
      order: { createdAt: 'ASC', id: 'ASC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return {
      comments: rows.map((comment) => this.toView(comment)),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
      hasMore: query.page * query.limit < total,
    };
  }

  async create(problemId: string, user: PublicUser, dto: CreateCommentDto): Promise<{ comment: CommentView }> {
    await this.requirePublishedProblem(problemId);
    if (dto.parentId) {
      const parent = await this.comments.findOneBy({
        id: dto.parentId,
        problemId,
        status: CommentStatus.Visible,
        deletedAt: IsNull(),
      });
      if (!parent) throw new NotFoundException('Không tìm thấy bình luận bạn muốn trả lời.');
    }
    const comment = await this.comments.save(this.comments.create({
      problemId,
      userId: user.id,
      parentId: dto.parentId ?? null,
      content: dto.content.trim(),
      status: CommentStatus.Visible,
      editedAt: null,
      deletedAt: null,
      deletedBy: null,
    }));
    await this.comments.manager.query(
      `INSERT INTO notifications (user_id, actor_id, problem_id, type, message)
       SELECT follow.user_id, ?, ?, 'new_comment',
              CONCAT('Có bình luận mới trong bài “', LEFT(problem.title, 220), '”.')
         FROM problem_follows follow
         JOIN problems problem ON problem.id = follow.problem_id
        WHERE follow.problem_id = ? AND follow.user_id != ?`,
      [user.id, problemId, problemId, user.id],
    );
    comment.user = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    } as CommentEntity['user'];
    return { comment: this.toView(comment) };
  }

  async update(commentId: string, user: PublicUser, dto: UpdateCommentDto): Promise<{ comment: CommentView }> {
    const comment = await this.comments.findOne({
      where: { id: commentId, status: CommentStatus.Visible, deletedAt: IsNull() },
      relations: { user: true },
    });
    if (!comment) throw new NotFoundException('Không tìm thấy bình luận.');
    if (comment.userId !== user.id) {
      throw new ForbiddenException('Bạn chỉ có thể sửa bình luận của chính mình.');
    }
    comment.content = dto.content.trim();
    comment.editedAt = new Date();
    await this.comments.save(comment);
    return { comment: this.toView(comment) };
  }

  async softDelete(commentId: string, user: PublicUser): Promise<void> {
    const comment = await this.comments.findOneBy({
      id: commentId,
      status: CommentStatus.Visible,
      deletedAt: IsNull(),
    });
    if (!comment) throw new NotFoundException('Không tìm thấy bình luận.');
    if (comment.userId !== user.id && !this.isModerator(user)) {
      throw new ForbiddenException('Bạn không có quyền xóa bình luận này.');
    }
    comment.deletedAt = new Date();
    comment.deletedBy = user.id;
    await this.comments.save(comment);
  }

  async report(commentId: string, user: PublicUser, dto: ReportCommentDto): Promise<{ message: string }> {
    const comment = await this.comments.findOneBy({
      id: commentId,
      status: CommentStatus.Visible,
      deletedAt: IsNull(),
    });
    if (!comment) throw new NotFoundException('Không tìm thấy bình luận.');
    try {
      await this.reports.save(this.reports.create({
        commentId,
        reporterId: user.id,
        reason: dto.reason,
        details: dto.details?.trim() || null,
        status: CommentReportStatus.Pending,
        reviewedAt: null,
        reviewedBy: null,
      }));
    } catch (error) {
      if (this.isDuplicateEntry(error)) {
        throw new ConflictException('Bạn đã báo cáo bình luận này.');
      }
      throw error;
    }
    return { message: 'Đã gửi báo cáo tới đội ngũ kiểm duyệt.' };
  }

  private async requirePublishedProblem(problemId: string): Promise<void> {
    const problem = await this.problems.findOneBy({
      id: problemId,
      status: ProblemStatus.Published,
      deletedAt: IsNull(),
    });
    if (!problem) throw new NotFoundException('Bài toán chưa được xuất bản hoặc không tồn tại.');
  }

  private toView(comment: CommentEntity): CommentView {
    const deleted = comment.deletedAt !== null;
    return {
      id: String(comment.id),
      problemId: String(comment.problemId),
      parentId: comment.parentId ? String(comment.parentId) : null,
      content: deleted ? '[Bình luận đã được xóa]' : comment.content,
      deleted,
      edited: comment.editedAt !== null,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      author: {
        id: String(comment.user.id),
        username: comment.user.username,
        name: comment.user.name,
        role: comment.user.role,
      },
    };
  }

  private isModerator(user: PublicUser): boolean {
    return user.role === UserRole.Moderator || user.role === UserRole.Admin;
  }

  private isDuplicateEntry(error: unknown): boolean {
    return error instanceof QueryFailedError &&
      (error.driverError as { code?: string }).code === 'ER_DUP_ENTRY';
  }
}
