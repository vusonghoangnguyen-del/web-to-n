import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { LatexFileEntity } from './latex-file.entity';
import { UserEntity } from './user.entity';

export enum LatexCompiler {
  PdfLatex = 'pdflatex',
  XeLatex = 'xelatex',
  LuaLatex = 'lualatex',
}

@Entity({ name: 'latex_projects' })
@Index('idx_latex_projects_owner_updated', ['ownerId', 'updatedAt'])
export class LatexProjectEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'owner_id', type: 'bigint', unsigned: true })
  ownerId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'owner_id', foreignKeyConstraintName: 'fk_latex_projects_owner' })
  owner!: UserEntity;

  @Column({ type: 'varchar', length: 120 })
  title!: string;

  @Column({ type: 'enum', enum: LatexCompiler, default: LatexCompiler.PdfLatex })
  compiler!: LatexCompiler;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updatedAt!: Date;

  @OneToMany(() => LatexFileEntity, (file) => file.project)
  files!: LatexFileEntity[];
}
