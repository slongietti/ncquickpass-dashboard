import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { SESSION_COOKIE, isSessionValid, parseSession } from './session';

/** Guards proxy routes: requires a valid signed session cookie. */
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const raw = req.signedCookies?.[SESSION_COOKIE];
    const session = parseSession(raw);
    if (!isSessionValid(session)) {
      throw new UnauthorizedException('Not authenticated');
    }
    // Attach for @CurrentSession() to read downstream.
    (req as Request & { ncqp?: unknown }).ncqp = session;
    return true;
  }
}
