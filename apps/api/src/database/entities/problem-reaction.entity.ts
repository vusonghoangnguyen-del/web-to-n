import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { ProblemEntity } from './problem.entity';
import { UserEntity } from './user.entity';

@Entity({ name: 'problem_reactions' })
@Index('idx_problem_reactions_problem', ['problemId'])
export class ProblemReactionEntity {
  @PrimaryColumn({ name: 'user_id', type: 'bigint', unsigned: true })
  userId!: string;

  @PrimaryColumn({ name: 'problem_id', type: 'bigint', unsigned: true })
  problemId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_problem_reactions_user' })
  user!: UserEntity;

  @ManyToOne(() => ProblemEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'problem_id', foreignKeyConstraintName: 'fk_problem_reactions_problem' })
  problem!: ProblemEntity;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}
