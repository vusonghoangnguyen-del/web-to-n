import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BookmarkEntity } from './bookmark.entity';
import { CommentEntity } from './comment.entity';
import { ProblemCategoryEntity } from './problem-category.entity';
import { SolutionEntity } from './solution.entity';
import { UserEntity } from './user.entity';

export enum ProblemDifficulty {
  Easy = 'Dễ',
  Medium = 'Trung bình',
  Hard = 'Khó',
  Challenge = 'Thử thách',
}

export enum ProblemStatus {
  Draft = 'draft',
  Pending = 'pending',
  Published = 'published',
  Rejected = 'rejected',
}

@Entity({ name: 'problems' })
@Index('idx_problems_author', ['authorId'])
@Index('idx_problems_status_created', ['status', 'createdAt'])
export class ProblemEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'author_id', type: 'bigint', unsigned: true })
  authorId!: string;

  @ManyToOne(() => UserEntity, (user) => user.problems, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'author_id', foreignKeyConstraintName: 'fk_problems_author' })
  author!: UserEntity;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  source!: string | null;

  @Column({ type: 'enum', enum: ProblemDifficulty, default: ProblemDifficulty.Medium })
  difficulty!: ProblemDifficulty;

  @Column({ type: 'enum', enum: ProblemStatus, default: ProblemStatus.Pending })
  status!: ProblemStatus;

  @Column({ name: 'published_at', type: 'timestamp', nullable: true })
  publishedAt!: Date | null;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @Column({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt!: Date;

  @OneToMany(() => ProblemCategoryEntity, (link) => link.problem)
  categoryLinks!: ProblemCategoryEntity[];

  @OneToMany(() => SolutionEntity, (solution) => solution.problem)
  solutions!: SolutionEntity[];

  @OneToMany(() => CommentEntity, (comment) => comment.problem)
  comments!: CommentEntity[];

  @OneToMany(() => BookmarkEntity, (bookmark) => bookmark.problem)
  bookmarks!: BookmarkEntity[];
}
