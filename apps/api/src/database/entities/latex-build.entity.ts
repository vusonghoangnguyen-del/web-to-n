import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { LatexCompiler, LatexProjectEntity } from './latex-project.entity';

export enum LatexBuildStatus {
  Queued = 'queued',
  Compiling = 'compiling',
  Success = 'success',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

@Entity({ name: 'latex_builds' })
@Index('idx_latex_builds_project_created', ['projectId', 'createdAt'])
export class LatexBuildEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'project_id', type: 'bigint', unsigned: true })
  projectId!: string;

  @ManyToOne(() => LatexProjectEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id', foreignKeyConstraintName: 'fk_latex_builds_project' })
  project!: LatexProjectEntity;

  @Column({ type: 'enum', enum: LatexBuildStatus, default: LatexBuildStatus.Queued })
  status!: LatexBuildStatus;

  @Column({ type: 'enum', enum: LatexCompiler })
  compiler!: LatexCompiler;

  @Column({ name: 'source_snapshot', type: 'mediumtext', select: false })
  sourceSnapshot!: string;

  @Column({ name: 'source_archive', type: 'longblob', nullable: true, select: false })
  sourceArchive!: Buffer | null;

  @Column({ name: 'source_sha256', type: 'char', length: 64 })
  sourceSha256!: string;

  @Column({ name: 'pdf_path', type: 'varchar', length: 255, nullable: true })
  pdfPath!: string | null;

  @Column({ name: 'compile_log', type: 'mediumtext', nullable: true, select: false })
  compileLog!: string | null;

  @Column({ name: 'error_message', type: 'varchar', length: 500, nullable: true })
  errorMessage!: string | null;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt!: Date | null;
}
