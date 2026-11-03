import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProblemEntity } from './problem.entity';
import { UserEntity } from './user.entity';

export enum SolutionStatus {
  Pending = 'pending',
  Verified = 'verified',
  Rejected = 'rejected',
  Withdrawn = 'withdrawn',
}

@Entity({ name: 'solutions' })
@Index('idx_solutions_problem', ['problemId'])
@Index('idx_solutions_author', ['authorId'])
@Index('idx_solutions_public', ['problemId', 'status', 'isFeatured', 'createdAt'])
@Index('idx_solutions_reviewed_by', ['reviewedBy'])
@Index('idx_solutions_featured_by', ['featuredBy'])
export class SolutionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'problem_id', type: 'bigint', unsigned: true })
  problemId!: string;

  @Column({ name: 'author_id', type: 'bigint', unsigned: true })
  authorId!: string;

  @ManyToOne(() => ProblemEntity, (problem) => problem.solutions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'problem_id', foreignKeyConstraintName: 'fk_solutions_problem' })
  problem!: ProblemEntity;

  @ManyToOne(() => UserEntity, (user) => user.solutions, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'author_id', foreignKeyConstraintName: 'fk_solutions_author' })
  author!: UserEntity;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'enum', enum: SolutionStatus, default: SolutionStatus.Pending })
  status!: SolutionStatus;

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

  @Column({ name: 'withdrawn_at', type: 'timestamp', nullable: true })
  withdrawnAt!: Date | null;

  @Column({ name: 'reviewed_at', type: 'timestamp', nullable: true })
  reviewedAt!: Date | null;

  @Column({ name: 'reviewed_by', type: 'bigint', unsigned: true, nullable: true })
  reviewedBy!: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewed_by', foreignKeyConstraintName: 'fk_solutions_reviewed_by' })
  reviewer!: UserEntity | null;

  @Column({ name: 'review_note', type: 'varchar', length: 500, nullable: true })
  reviewNote!: string | null;

  @Column({ name: 'is_featured', type: 'boolean', default: false })
  isFeatured!: boolean;

  @Column({ name: 'featured_at', type: 'timestamp', nullable: true })
  featuredAt!: Date | null;

  @Column({ name: 'featured_by', type: 'bigint', unsigned: true, nullable: true })
  featuredBy!: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'featured_by', foreignKeyConstraintName: 'fk_solutions_featured_by' })
  featuredByUser!: UserEntity | null;
}
