import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { DataSource, IsNull, MoreThan, QueryFailedError, Repository } from 'typeorm';
import { EmailVerificationTokenEntity } from '../database/entities/email-verification-token.entity';
import { PasswordResetTokenEntity } from '../database/entities/password-reset-token.entity';
import { SessionEntity } from '../database/entities/session.entity';
import { UserEntity, UserRole, UserStatus } from '../database/entities/user.entity';
import { MailService } from '../mail/mail.service';
import { ClientContext, PublicUser } from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

type AuthenticatedResult = {
  sessionToken: string;
  user: PublicUser;
};

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    @InjectRepository(SessionEntity) private readonly sessions: Repository<SessionEntity>,
    @InjectRepository(EmailVerificationTokenEntity)
    private readonly verificationTokens: Repository<EmailVerificationTokenEntity>,
    @InjectRepository(PasswordResetTokenEntity)
    private readonly resetTokens: Repository<PasswordResetTokenEntity>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  async register(dto: RegisterDto): Promise<{ message: string }> {
    if (dto.password !== dto.passwordConfirmation) {
      throw new BadRequestException('Mật khẩu nhập lại không khớp.');
    }

    let emailToken = '';
    let user: UserEntity;
    try {
      user = await this.dataSource.transaction(async (manager) => {
        const userRepository = manager.getRepository(UserEntity);
        const tokenRepository = manager.getRepository(EmailVerificationTokenEntity);
        if (await userRepository.exists({ where: [{ email: dto.email }, { username: dto.username }] })) {
          throw new ConflictException('Email hoặc tên đăng nhập đã được sử dụng.');
        }

        const passwordHash = await bcrypt.hash(dto.password, 12);
        const createdUser = await userRepository.save(
          userRepository.create({
            username: dto.username,
            name: dto.username,
            email: dto.email,
            passwordHash,
            role: UserRole.Reader,
            status: UserStatus.Active,
            emailVerifiedAt: null,
          }),
        );

        emailToken = this.createOpaqueToken();
        await tokenRepository.save(
          tokenRepository.create({
            userId: createdUser.id,
            tokenHash: this.hashToken(emailToken),
            expiresAt: this.emailTokenExpiry(),
            consumedAt: null,
          }),
        );
        return createdUser;
      });
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      if (error instanceof QueryFailedError && (error.driverError as { code?: string }).code === 'ER_DUP_ENTRY') {
        throw new ConflictException('Email hoặc tên đăng nhập đã được sử dụng.');
      }
      throw error;
    }

    try {
      await this.mail.sendVerificationEmail({ email: user.email, name: user.name, token: emailToken });
    } catch {
      throw new ServiceUnavailableException(
        'Tài khoản đã được tạo nhưng chưa gửi được email. Hãy dùng chức năng gửi lại email xác minh.',
      );
    }

    return { message: 'Vui lòng kiểm tra email để hoàn tất đăng ký.' };
  }

  async verifyEmail(token: string, context: ClientContext): Promise<AuthenticatedResult> {
    const now = new Date();
    const user = await this.dataSource.transaction(async (manager) => {
      const tokenRepository = manager.getRepository(EmailVerificationTokenEntity);
      const userRepository = manager.getRepository(UserEntity);
      const verification = await tokenRepository.findOne({
        where: {
          tokenHash: this.hashToken(token),
          consumedAt: IsNull(),
          expiresAt: MoreThan(now),
        },
      });
      if (!verification) {
        throw new BadRequestException('Liên kết xác minh không hợp lệ hoặc đã hết hạn.');
      }

      const account = await userRepository.findOneBy({ id: verification.userId });
      if (!account) throw new BadRequestException('Tài khoản không còn tồn tại.');
      if (account.status !== UserStatus.Active) {
        throw new ForbiddenException('Tài khoản hiện không thể được kích hoạt.');
      }

      verification.consumedAt = now;
      account.emailVerifiedAt = now;
      await tokenRepository.save(verification);
      await tokenRepository.update(
        { userId: account.id, consumedAt: IsNull() },
        { consumedAt: now },
      );
      return userRepository.save(account);
    });

    return this.createAuthenticatedResult(user, context);
  }

  async resendVerification(email: string): Promise<{ message: string }> {
    const generic = { message: 'Nếu tài khoản tồn tại và chưa xác minh, email mới sẽ được gửi.' };
    const user = await this.users.findOneBy({ email, status: UserStatus.Active });
    if (!user || user.emailVerifiedAt) return generic;

    const latest = await this.verificationTokens.findOne({
      where: { userId: user.id },
      order: { createdAt: 'DESC' },
    });
    if (latest && Date.now() - latest.createdAt.getTime() < 60_000) return generic;

    const token = this.createOpaqueToken();
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(EmailVerificationTokenEntity);
      await repository.update({ userId: user.id, consumedAt: IsNull() }, { consumedAt: new Date() });
      await repository.save(
        repository.create({
          userId: user.id,
          tokenHash: this.hashToken(token),
          expiresAt: this.emailTokenExpiry(),
          consumedAt: null,
        }),
      );
    });
    await this.mail.sendVerificationEmail({ email: user.email, name: user.name, token });
    return generic;
  }

  async login(dto: LoginDto, context: ClientContext): Promise<AuthenticatedResult> {
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: dto.email })
      .getOne();
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng.');
    }
    if (!user.emailVerifiedAt) {
      throw new ForbiddenException('Vui lòng xác minh email trước khi đăng nhập.');
    }
    if (user.status !== UserStatus.Active) {
      throw new UnauthorizedException('Tài khoản hiện không thể đăng nhập.');
    }
    return this.createAuthenticatedResult(user, context);
  }

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const generic = { message: 'Nếu email thuộc tài khoản đang hoạt động, bạn sẽ nhận được liên kết đặt lại mật khẩu.' };
    const user = await this.users.findOneBy({ email, status: UserStatus.Active });
    if (!user?.emailVerifiedAt) return generic;

    const latest = await this.resetTokens.findOne({ where: { userId: user.id }, order: { createdAt: 'DESC' } });
    if (latest && Date.now() - latest.createdAt.getTime() < 60_000) return generic;

    const token = this.createOpaqueToken();
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(PasswordResetTokenEntity);
      await repository.update({ userId: user.id, consumedAt: IsNull() }, { consumedAt: new Date() });
      await repository.save(repository.create({
        userId: user.id,
        tokenHash: this.hashToken(token),
        expiresAt: new Date(Date.now() + 30 * 60_000),
        consumedAt: null,
      }));
    });
    try {
      await this.mail.sendPasswordResetEmail({ email: user.email, name: user.name, token });
    } catch (error) {
      console.error('Không gửi được email đặt lại mật khẩu:', error);
    }
    return generic;
  }

  async resetPassword(token: string, password: string, passwordConfirmation: string): Promise<{ message: string }> {
    if (password !== passwordConfirmation) throw new BadRequestException('Mật khẩu nhập lại không khớp.');
    await this.dataSource.transaction(async (manager) => {
      const resetRepository = manager.getRepository(PasswordResetTokenEntity);
      const reset = await resetRepository.createQueryBuilder('reset')
        .where('reset.tokenHash = :hash', { hash: this.hashToken(token) })
        .setLock('pessimistic_write')
        .getOne();
      const now = new Date();
      if (!reset || reset.consumedAt || reset.expiresAt <= now) {
        throw new BadRequestException('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
      }
      const users = manager.getRepository(UserEntity);
      const user = await users.findOneBy({ id: reset.userId, status: UserStatus.Active });
      if (!user?.emailVerifiedAt) throw new BadRequestException('Tài khoản không còn hợp lệ.');
      await users.update(user.id, { passwordHash: await bcrypt.hash(password, 12) });
      await resetRepository.update({ userId: user.id, consumedAt: IsNull() }, { consumedAt: now });
      await manager.getRepository(SessionEntity).update({ userId: user.id, revokedAt: IsNull() }, { revokedAt: now });
    });
    return { message: 'Mật khẩu đã được đổi. Vui lòng đăng nhập lại.' };
  }

  async authenticate(sessionToken: string): Promise<PublicUser> {
    const session = await this.sessions.findOne({
      where: {
        tokenHash: this.hashToken(sessionToken),
        revokedAt: IsNull(),
        expiresAt: MoreThan(new Date()),
      },
      relations: { user: true },
    });
    if (
      !session ||
      session.user.status !== UserStatus.Active ||
      !session.user.emailVerifiedAt
    ) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
    }

    if (Date.now() - session.lastUsedAt.getTime() > 5 * 60_000) {
      await this.sessions.update(session.id, { lastUsedAt: new Date() });
    }
    return this.toPublicUser(session.user);
  }

  async logout(sessionToken?: string): Promise<void> {
    if (!sessionToken) return;
    await this.sessions.update(
      { tokenHash: this.hashToken(sessionToken), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async logoutAll(userId: string): Promise<void> {
    await this.sessions.update(
      { userId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  private async createAuthenticatedResult(
    user: UserEntity,
    context: ClientContext,
  ): Promise<AuthenticatedResult> {
    const sessionToken = this.createOpaqueToken();
    const ttlDays = this.config.getOrThrow<number>('SESSION_TTL_DAYS');
    await this.sessions.save(
      this.sessions.create({
        id: randomUUID(),
        userId: user.id,
        tokenHash: this.hashToken(sessionToken),
        expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
        lastUsedAt: new Date(),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent?.slice(0, 500) ?? null,
        revokedAt: null,
      }),
    );
    return { sessionToken, user: this.toPublicUser(user) };
  }

  private toPublicUser(user: UserEntity): PublicUser {
    return {
      id: String(user.id),
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      emailVerified: Boolean(user.emailVerifiedAt),
    };
  }

  private createOpaqueToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private emailTokenExpiry(): Date {
    const minutes = this.config.getOrThrow<number>('EMAIL_VERIFICATION_TTL_MINUTES');
    return new Date(Date.now() + minutes * 60_000);
  }
}
