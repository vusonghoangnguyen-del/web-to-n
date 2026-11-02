import { Column, Entity, Index, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ProblemCategoryEntity } from './problem-category.entity';

@Entity({ name: 'categories' })
@Index('uq_categories_slug', ['slug'], { unique: true })
export class CategoryEntity {
  @PrimaryGeneratedColumn({ type: 'smallint', unsigned: true })
  id!: number;

  @Column({ type: 'varchar', length: 80 })
  name!: string;

  @Column({ type: 'varchar', length: 80 })
  slug!: string;

  @OneToMany(() => ProblemCategoryEntity, (link) => link.category)
  problemLinks!: ProblemCategoryEntity[];
}
