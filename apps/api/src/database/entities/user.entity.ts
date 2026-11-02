import { Column, Entity, Index, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { BookmarkEntity } from './bookmark.entity';
import { CommentEntity } from './comment.entity';
import { ProblemEntity } from './problem.entity';
import { SolutionEntity } from './solution.entity';
import { VideoEntity } from './video.entity';
import { SessionEntity } from './session.entity';
import { EmailVerificationTokenEntity } from './email-verification-token.entity';

export enum UserRole {
  Reader = 'reader',
  Editor = 'editor',
  Moderator = 'moderator',
  Admin = 'admin',
}

export enum UserStatus {
  PendingVerification = 'pending_verification',
  Active = 'active',
  Suspended = 'suspended',
  Disabled = 'disabled',
}

@Entity({ name: 'users' })
@Index('uq_users_email', ['email'], { unique: true })
export class UserEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255, select: false })
  passwordHash!: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.Reader })
  role!: UserRole;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.Active })
  status!: UserStatus;

  @Column({ name: 'email_verified_at', type: 'timestamp', nullable: true })
  emailVerifiedAt!: Date | null;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt!: Date;

  @Column({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt!: Date;

  @OneToMany(() => ProblemEntity, (problem) => problem.author)
  problems!: ProblemEntity[];

  @OneToMany(() => SolutionEntity, (solution) => solution.author)
  solutions!: SolutionEntity[];

  @OneToMany(() => CommentEntity, (comment) => comment.user)
  comments!: CommentEntity[];

  @OneToMany(() => BookmarkEntity, (bookmark) => bookmark.user)
  bookmarks!: BookmarkEntity[];

  @OneToMany(() => VideoEntity, (video) => video.author)
  videos!: VideoEntity[];

  @OneToMany(() => SessionEntity, (session) => session.user)
  sessions!: SessionEntity[];

  @OneToMany(() => EmailVerificationTokenEntity, (token) => token.user)
  emailVerificationTokens!: EmailVerificationTokenEntity[];
}
