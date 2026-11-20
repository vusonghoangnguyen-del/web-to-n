import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CookieOptions, Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LEGACY_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME } from './auth.constants';
import { ClientContext, PublicUser } from './auth.types';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { SessionGuard } from './guards/session.guard';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @ApiOperation({ summary: 'Tạo tài khoản reader và gửi email xác minh' })
  register(@Body() dto: RegisterDto): Promise<{ message: string }> {
    return this.auth.register(dto);
  }

  @Post('email/verify')
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  @ApiOperation({ summary: 'Xác minh email và tạo session' })
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: PublicUser }> {
    const result = await this.auth.verifyEmail(dto.token, this.clientContext(request));
    this.setSessionCookie(response, result.sessionToken);
    return { user: result.user };
  }

  @Post('email/resend')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60 * 60_000 } })
  @ApiOperation({ summary: 'Gửi lại email xác minh với phản hồi chống dò email' })
  resend(@Body() dto: ResendVerificationDto): Promise<{ message: string }> {
    return this.auth.resendVerification(dto.email);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  @ApiOperation({ summary: 'Đăng nhập bằng email và mật khẩu' })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ user: PublicUser }> {
    const result = await this.auth.login(dto, this.clientContext(request));
    this.setSessionCookie(response, result.sessionToken);
    return { user: result.user };
  }

  @Post('password/forgot')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60 * 60_000 } })
  @ApiOperation({ summary: 'Gửi liên kết đặt lại mật khẩu nếu tài khoản tồn tại' })
  forgotPassword(@Body() dto: PasswordResetRequestDto): Promise<{ message: string }> {
    return this.auth.requestPasswordReset(dto.email);
  }

  @Post('password/reset')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @ApiOperation({ summary: 'Đặt lại mật khẩu bằng liên kết email một lần' })
  resetPassword(@Body() dto: PasswordResetConfirmDto): Promise<{ message: string }> {
    return this.auth.resetPassword(dto.token, dto.password, dto.passwordConfirmation);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Thu hồi session hiện tại' })
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<void> {
    await this.auth.logout(request.cookies?.[SESSION_COOKIE_NAME] as string | undefined);
    this.clearSessionCookies(response);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Thu hồi mọi session của tài khoản' })
  async logoutAll(
    @CurrentUser() user: PublicUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logoutAll(user.id);
    this.clearSessionCookies(response);
  }

  @Get('me')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Lấy tài khoản của session hiện tại' })
  me(@CurrentUser() user: PublicUser): { user: PublicUser } {
    return { user };
  }

  private clientContext(request: Request): ClientContext {
    return {
      ipAddress: request.ip || request.socket.remoteAddress || null,
      userAgent: request.get('user-agent') ?? null,
    };
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.getOrThrow<string>('NODE_ENV') === 'production',
      path: '/',
    };
  }

  private setSessionCookie(response: Response, token: string): void {
    const ttlDays = this.config.getOrThrow<number>('SESSION_TTL_DAYS');
    response.cookie(SESSION_COOKIE_NAME, token, {
      ...this.cookieOptions(),
      maxAge: ttlDays * 24 * 60 * 60 * 1000,
    });
  }

  private clearSessionCookies(response: Response): void {
    response.clearCookie(SESSION_COOKIE_NAME, this.cookieOptions());
    response.clearCookie(LEGACY_SESSION_COOKIE_NAME, this.cookieOptions());
  }
}
