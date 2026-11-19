import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { LatexProjectEntity } from './latex-project.entity';

@Entity({ name: 'latex_files' })
@Index('uq_latex_files_project_path', ['projectId', 'relativePath'], { unique: true })
export class LatexFileEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'project_id', type: 'bigint', unsigned: true })
  projectId!: string;

  @ManyToOne(() => LatexProjectEntity, (project) => project.files, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id', foreignKeyConstraintName: 'fk_latex_files_project' })
  project!: LatexProjectEntity;

  @Column({ name: 'relative_path', type: 'varchar', length: 255 })
  relativePath!: string;

  @Column({ type: 'mediumtext' })
  content!: string;

  @Column({ name: 'binary_content', type: 'mediumblob', nullable: true, select: false })
  binaryContent!: Buffer | null;

  @Column({ name: 'mime_type', type: 'varchar', length: 80, default: 'text/x-tex' })
  mimeType!: string;

  @Column({ name: 'size_bytes', type: 'int', unsigned: true, default: 0 })
  sizeBytes!: number;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt!: Date;
}
