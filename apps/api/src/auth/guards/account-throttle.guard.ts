import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerException, ThrottlerStorage } from '@nestjs/throttler';
import { SetMetadata } from '@nestjs/common';
import { Request } from 'express';
import { PublicUser } from '../auth.types';

type Limit = { count: number; ttlMs: number };
type AuthenticatedRequest = Request & { authUser?: PublicUser };
const key = 'account-rate-limit';

export const AccountRateLimit = (count: number, ttlMs: number) => SetMetadata(key, { count, ttlMs });

@Injectable()
export class AccountThrottleGuard implements CanActivate {
  constructor(
    @Inject(ThrottlerStorage) private readonly storage: ThrottlerStorage,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const limit = this.reflector.getAllAndOverride<Limit>(key, [context.getHandler(), context.getClass()]);
    if (!limit) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.authUser) throw new UnauthorizedException('Bạn cần đăng nhập.');
    const route = `${context.getClass().name}:${context.getHandler().name}`;
    const result = await this.storage.increment(
      `account:${request.authUser.id}:${route}`, limit.ttlMs, limit.count, limit.ttlMs, 'account',
    );
    if (result.isBlocked) throw new ThrottlerException('Bạn thao tác quá nhanh. Vui lòng thử lại sau.');
    return true;
  }
}
