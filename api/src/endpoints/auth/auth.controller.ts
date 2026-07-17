import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from '../../models/auth/LoginDto';
import { SESSION_COOKIE, isSessionValid, parseSession } from './session/session';
import { sessionCookieOptions, writeSessionCookie } from './session/session-cookie';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ authenticated: true; accountId: string }> {
    const session = await this.auth.login(dto.username, dto.password);
    writeSessionCookie(res, session, this.secure());
    return { authenticated: true, accountId: session.accountId };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response): { authenticated: false } {
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions(this.secure()));
    return { authenticated: false };
  }

  @Get('me')
  me(@Req() req: Request): { authenticated: boolean; accountId?: string } {
    const session = parseSession(req.signedCookies?.[SESSION_COOKIE]);
    if (isSessionValid(session)) {
      return { authenticated: true, accountId: session.accountId };
    }
    return { authenticated: false };
  }

  private secure(): boolean {
    return this.config.get<string>('COOKIE_SECURE', 'false') === 'true';
  }
}
