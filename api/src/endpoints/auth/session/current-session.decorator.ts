import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { Request } from 'express';
import { NcqpSession } from './session';

/** Injects the validated session attached by AuthGuard. */
export const CurrentSession = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): NcqpSession => {
    const req = ctx.switchToHttp().getRequest<Request & { ncqp: NcqpSession }>();
    return req.ncqp;
  },
);
