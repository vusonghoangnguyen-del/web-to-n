import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { CategoryEntity } from './category.entity';
import { ProblemEntity } from './problem.entity';

@Entity({ name: 'problem_categories' })
@Index('idx_problem_categories_category', ['categoryId'])
export class ProblemCategoryEntity {
  @PrimaryColumn({ name: 'problem_id', type: 'bigint', unsigned: true })
  problemId!: string;

  @PrimaryColumn({ name: 'category_id', type: 'smallint', unsigned: true })
  categoryId!: number;

  @ManyToOne(() => ProblemEntity, (problem) => problem.categoryLinks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'problem_id', foreignKeyConstraintName: 'fk_problem_categories_problem' })
  problem!: ProblemEntity;

  @ManyToOne(() => CategoryEntity, (category) => category.problemLinks, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id', foreignKeyConstraintName: 'fk_problem_categories_category' })
  category!: CategoryEntity;
}
