import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ProblemDifficulty, ProblemEntity, ProblemStatus } from './problem.entity';
import { UserEntity } from './user.entity';

@Entity({ name: 'problem_revisions' })
@Index('uq_problem_revisions_version', ['problemId', 'version'], { unique: true })
@Index('idx_problem_revisions_editor', ['editorId'])
export class ProblemRevisionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'problem_id', type: 'bigint', unsigned: true })
  problemId!: string;

  @ManyToOne(() => ProblemEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'problem_id', foreignKeyConstraintName: 'fk_problem_revisions_problem' })
  problem!: ProblemEntity;

  @Column({ name: 'editor_id', type: 'bigint', unsigned: true })
  editorId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'editor_id', foreignKeyConstraintName: 'fk_problem_revisions_editor' })
  editor!: UserEntity;

  @Column({ type: 'int', unsigned: true })
  version!: number;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ name: 'latex_build_id', type: 'bigint', unsigned: true, nullable: true })
  latexBuildId!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  source!: string | null;

  @Column({ type: 'enum', enum: ProblemDifficulty })
  difficulty!: ProblemDifficulty;

  @Column({ type: 'enum', enum: ProblemStatus })
  status!: ProblemStatus;

  @Column({ name: 'category_slugs', type: 'json' })
  categorySlugs!: string[];

  @Column({ name: 'change_summary', type: 'varchar', length: 500, nullable: true })
  changeSummary!: string | null;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}
