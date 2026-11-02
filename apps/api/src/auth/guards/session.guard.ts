import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { SESSION_COOKIE_NAME } from '../auth.constants';
import { PublicUser } from '../auth.types';

type AuthenticatedRequest = Request & { authUser?: PublicUser };

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
    if (!token) throw new UnauthorizedException('Bạn cần đăng nhập.');
    request.authUser = await this.auth.authenticate(token);
    return true;
  }
}
