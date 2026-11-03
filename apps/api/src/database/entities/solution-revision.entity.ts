import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { SolutionEntity, SolutionStatus } from './solution.entity';
import { UserEntity } from './user.entity';

@Entity({ name: 'solution_revisions' })
@Index('uq_solution_revisions_version', ['solutionId', 'version'], { unique: true })
@Index('idx_solution_revisions_editor', ['editorId'])
export class SolutionRevisionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'solution_id', type: 'bigint', unsigned: true })
  solutionId!: string;

  @ManyToOne(() => SolutionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'solution_id', foreignKeyConstraintName: 'fk_solution_revisions_solution' })
  solution!: SolutionEntity;

  @Column({ name: 'editor_id', type: 'bigint', unsigned: true })
  editorId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'editor_id', foreignKeyConstraintName: 'fk_solution_revisions_editor' })
  editor!: UserEntity;

  @Column({ type: 'int', unsigned: true })
  version!: number;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'enum', enum: SolutionStatus })
  status!: SolutionStatus;

  @Column({ name: 'change_summary', type: 'varchar', length: 500, nullable: true })
  changeSummary!: string | null;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}
