import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailVerificationTokenEntity } from '../database/entities/email-verification-token.entity';
import { SessionEntity } from '../database/entities/session.entity';
import { UserEntity } from '../database/entities/user.entity';
import { MailModule } from '../mail/mail.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RolesGuard } from './guards/roles.guard';
import { SessionGuard } from './guards/session.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, SessionEntity, EmailVerificationTokenEntity]),
    MailModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, SessionGuard, RolesGuard],
  exports: [AuthService, SessionGuard, RolesGuard],
})
export class AuthModule {}
