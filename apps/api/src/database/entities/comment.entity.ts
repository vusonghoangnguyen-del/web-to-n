import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProblemEntity } from './problem.entity';
import { UserEntity } from './user.entity';

export enum CommentStatus {
  Visible = 'visible',
  Hidden = 'hidden',
}

@Entity({ name: 'comments' })
@Index('idx_comments_problem_created', ['problemId', 'createdAt'])
@Index('idx_comments_user', ['userId'])
@Index('idx_comments_parent', ['parentId'])
@Index('idx_comments_visible_page', ['problemId', 'status', 'deletedAt', 'createdAt'])
@Index('idx_comments_deleted_by', ['deletedBy'])
export class CommentEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'problem_id', type: 'bigint', unsigned: true })
  problemId!: string;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true })
  userId!: string;

  @Column({ name: 'parent_id', type: 'bigint', unsigned: true, nullable: true })
  parentId!: string | null;

  @ManyToOne(() => ProblemEntity, (problem) => problem.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'problem_id', foreignKeyConstraintName: 'fk_comments_problem' })
  problem!: ProblemEntity;

  @ManyToOne(() => UserEntity, (user) => user.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_comments_user' })
  user!: UserEntity;

  @ManyToOne(() => CommentEntity, (comment) => comment.replies, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'parent_id', foreignKeyConstraintName: 'fk_comments_parent' })
  parent!: CommentEntity | null;

  @OneToMany(() => CommentEntity, (comment) => comment.parent)
  replies!: CommentEntity[];

  @Column({ type: 'varchar', length: 2000 })
  content!: string;

  @Column({ type: 'enum', enum: CommentStatus, default: CommentStatus.Visible })
  status!: CommentStatus;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @Column({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt!: Date;

  @Column({ name: 'edited_at', type: 'timestamp', nullable: true })
  editedAt!: Date | null;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt!: Date | null;

  @Column({ name: 'deleted_by', type: 'bigint', unsigned: true, nullable: true })
  deletedBy!: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'deleted_by', foreignKeyConstraintName: 'fk_comments_deleted_by' })
  deletedByUser!: UserEntity | null;
}
