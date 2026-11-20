import 'reflect-metadata';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerStorage } from '@nestjs/throttler';
import { describe, expect, it } from 'vitest';
import { AccountRateLimit, AccountThrottleGuard } from './account-throttle.guard';

describe('AccountThrottleGuard', () => {
  it('counts requests by account across sessions and does not block another account', async () => {
    class TestController {
      @AccountRateLimit(2, 60_000)
      create() {}
    }
    const counts = new Map<string, number>();
    const storage = {
      async increment(key: string, _ttl: number, limit: number) {
        const totalHits = (counts.get(key) || 0) + 1;
        counts.set(key, totalHits);
        return { totalHits, timeToExpire: 60_000, isBlocked: totalHits > limit, timeToBlockExpire: 60_000 };
      },
    } as ThrottlerStorage;
    const guard = new AccountThrottleGuard(storage, new Reflector());
    const controller = new TestController();
    const context = (id: string) => ({
      getClass: () => TestController,
      getHandler: () => controller.create,
      switchToHttp: () => ({ getRequest: () => ({ authUser: { id } }) }),
    }) as unknown as ExecutionContext;

    await expect(guard.canActivate(context('user-1'))).resolves.toBe(true);
    await expect(guard.canActivate(context('user-1'))).resolves.toBe(true);
    await expect(guard.canActivate(context('user-1'))).rejects.toMatchObject({ status: 429 });
    await expect(guard.canActivate(context('user-2'))).resolves.toBe(true);
    expect([...counts.keys()]).toEqual([
      'account:user-1:TestController:create',
      'account:user-2:TestController:create',
    ]);
  });
});
