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
}

@Entity({ name: 'solutions' })
@Index('idx_solutions_problem', ['problemId'])
@Index('idx_solutions_author', ['authorId'])
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
}
