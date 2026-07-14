import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SESSION_COOKIE, isSessionValid, parseSession } from './session';

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
    res.cookie(SESSION_COOKIE, JSON.stringify(session), {
      ...this.cookieOptions(),
      maxAge: Math.max(0, session.exp - Date.now()),
    });
    return { authenticated: true, accountId: session.accountId };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response): { authenticated: false } {
    res.clearCookie(SESSION_COOKIE, this.cookieOptions());
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

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      signed: true,
      sameSite: 'lax',
      secure: this.config.get<string>('COOKIE_SECURE', 'false') === 'true',
      path: '/',
    };
  }
}
