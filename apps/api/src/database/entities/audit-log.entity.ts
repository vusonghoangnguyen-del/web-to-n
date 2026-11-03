import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { UserEntity } from './user.entity';

@Entity({ name: 'audit_logs' })
@Index('idx_audit_logs_actor_created', ['actorId', 'createdAt'])
@Index('idx_audit_logs_target', ['targetType', 'targetId'])
export class AuditLogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ name: 'actor_id', type: 'bigint', unsigned: true, nullable: true })
  actorId!: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_id', foreignKeyConstraintName: 'fk_audit_logs_actor' })
  actor!: UserEntity | null;

  @Column({ type: 'varchar', length: 80 })
  action!: string;

  @Column({ name: 'target_type', type: 'varchar', length: 50 })
  targetType!: string;

  @Column({ name: 'target_id', type: 'varchar', length: 64 })
  targetId!: string;

  @Column({ type: 'json', nullable: true })
  details!: Record<string, unknown> | null;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;
}
