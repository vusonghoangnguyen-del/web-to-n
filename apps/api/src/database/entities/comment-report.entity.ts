import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { CommentEntity } from './comment.entity';
import { UserEntity } from './user.entity';

export enum CommentReportReason {
  Spam = 'spam',
  Harassment = 'harassment',
  Inappropriate = 'inappropriate',
  Misinformation = 'misinformation',
  Other = 'other',
}

export enum CommentReportStatus {
  Pending = 'pending',
  Reviewed = 'reviewed',
  Dismissed = 'dismissed',
}

@Entity({ name: 'comment_reports' })
@Index('uq_comment_reports_reporter', ['commentId', 'reporterId'], { unique: true })
@Index('idx_comment_reports_status_created', ['status', 'createdAt'])
@Index('idx_comment_reports_reviewed_by', ['reviewedBy'])
export class CommentReportEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'comment_id', type: 'bigint', unsigned: true })
  commentId!: string;

  @ManyToOne(() => CommentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'comment_id', foreignKeyConstraintName: 'fk_comment_reports_comment' })
  comment!: CommentEntity;

  @Column({ name: 'reporter_id', type: 'bigint', unsigned: true })
  reporterId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporter_id', foreignKeyConstraintName: 'fk_comment_reports_reporter' })
  reporter!: UserEntity;

  @Column({ type: 'enum', enum: CommentReportReason })
  reason!: CommentReportReason;

  @Column({ type: 'varchar', length: 500, nullable: true })
  details!: string | null;

  @Column({ type: 'enum', enum: CommentReportStatus, default: CommentReportStatus.Pending })
  status!: CommentReportStatus;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @Column({ name: 'reviewed_at', type: 'timestamp', nullable: true })
  reviewedAt!: Date | null;

  @Column({ name: 'reviewed_by', type: 'bigint', unsigned: true, nullable: true })
  reviewedBy!: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewed_by', foreignKeyConstraintName: 'fk_comment_reports_reviewer' })
  reviewer!: UserEntity | null;

  @Column({ name: 'resolution_note', type: 'varchar', length: 500, nullable: true })
  resolutionNote!: string | null;
}
