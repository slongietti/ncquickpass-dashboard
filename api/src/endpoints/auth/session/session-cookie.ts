import type { CookieOptions, Response } from 'express';
import { NcqpSession, SESSION_COOKIE } from './session';

/** Cookie flags for the session cookie. `secure` comes from COOKIE_SECURE. */
export function sessionCookieOptions(secure: boolean): CookieOptions {
  return {
    httpOnly: true,
    signed: true,
    sameSite: 'lax',
    secure,
    path: '/',
  };
}

/**
 * Write the session into the signed, HttpOnly cookie. Used on login and whenever
 * the BFF mints a fresh token (e.g. arming the schedule vault) so the browser
 * keeps holding a valid token.
 */
export function writeSessionCookie(res: Response, session: NcqpSession, secure: boolean): void {
  res.cookie(SESSION_COOKIE, JSON.stringify(session), {
    ...sessionCookieOptions(secure),
    maxAge: Math.max(0, session.exp - Date.now()),
  });
}
