import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { SolutionEntity } from './solution.entity';
import { UserEntity } from './user.entity';

@Entity({ name: 'solution_reactions' })
@Index('idx_solution_reactions_solution', ['solutionId'])
export class SolutionReactionEntity {
  @PrimaryColumn({ name: 'user_id', type: 'bigint', unsigned: true })
  userId!: string;

  @PrimaryColumn({ name: 'solution_id', type: 'bigint', unsigned: true })
  solutionId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_solution_reactions_user' })
  user!: UserEntity;

  @ManyToOne(() => SolutionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'solution_id', foreignKeyConstraintName: 'fk_solution_reactions_solution' })
  solution!: SolutionEntity;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}
