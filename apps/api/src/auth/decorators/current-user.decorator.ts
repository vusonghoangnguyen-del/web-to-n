import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { PublicUser } from '../auth.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): PublicUser => {
    const request = context.switchToHttp().getRequest<{ authUser: PublicUser }>();
    return request.authUser;
  },
);
