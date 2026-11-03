import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ProblemEntity } from './problem.entity';
import { UserEntity } from './user.entity';

export enum NotificationType {
  NewComment = 'new_comment',
  VerifiedSolution = 'verified_solution',
}

@Entity({ name: 'notifications' })
@Index('idx_notifications_user_unread', ['userId', 'readAt', 'createdAt'])
@Index('idx_notifications_problem', ['problemId'])
@Index('idx_notifications_actor', ['actorId'])
export class NotificationEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'user_id', type: 'bigint', unsigned: true })
  userId!: string;

  @Column({ name: 'actor_id', type: 'bigint', unsigned: true, nullable: true })
  actorId!: string | null;

  @Column({ name: 'problem_id', type: 'bigint', unsigned: true })
  problemId!: string;

  @Column({ type: 'enum', enum: NotificationType })
  type!: NotificationType;

  @Column({ type: 'varchar', length: 300 })
  message!: string;

  @Column({ name: 'read_at', type: 'timestamp', nullable: true })
  readAt!: Date | null;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_notifications_user' })
  user!: UserEntity;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_id', foreignKeyConstraintName: 'fk_notifications_actor' })
  actor!: UserEntity | null;

  @ManyToOne(() => ProblemEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'problem_id', foreignKeyConstraintName: 'fk_notifications_problem' })
  problem!: ProblemEntity;
}
