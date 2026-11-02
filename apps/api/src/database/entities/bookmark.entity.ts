import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { ProblemEntity } from './problem.entity';
import { UserEntity } from './user.entity';

@Entity({ name: 'bookmarks' })
@Index('idx_bookmarks_problem', ['problemId'])
export class BookmarkEntity {
  @PrimaryColumn({ name: 'user_id', type: 'bigint', unsigned: true })
  userId!: string;

  @PrimaryColumn({ name: 'problem_id', type: 'bigint', unsigned: true })
  problemId!: string;

  @ManyToOne(() => UserEntity, (user) => user.bookmarks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_bookmarks_user' })
  user!: UserEntity;

  @ManyToOne(() => ProblemEntity, (problem) => problem.bookmarks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'problem_id', foreignKeyConstraintName: 'fk_bookmarks_problem' })
  problem!: ProblemEntity;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}
