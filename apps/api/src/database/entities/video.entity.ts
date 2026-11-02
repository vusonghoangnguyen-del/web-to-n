import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';

export enum VideoStatus {
  Pending = 'pending',
  Published = 'published',
  Rejected = 'rejected',
}

@Entity({ name: 'videos' })
@Index('idx_videos_author', ['authorId'])
export class VideoEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'author_id', type: 'bigint', unsigned: true })
  authorId!: string;

  @ManyToOne(() => UserEntity, (user) => user.videos, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'author_id', foreignKeyConstraintName: 'fk_videos_author' })
  author!: UserEntity;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'varchar', length: 80 })
  topic!: string;

  @Column({ type: 'varchar', length: 20 })
  duration!: string;

  @Column({ type: 'varchar', length: 1000 })
  url!: string;

  @Column({ type: 'enum', enum: VideoStatus, default: VideoStatus.Pending })
  status!: VideoStatus;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}
