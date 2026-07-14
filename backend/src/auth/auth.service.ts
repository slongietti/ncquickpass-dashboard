import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { NcqpService } from '../ncqp/ncqp.service';
import { NcqpUserInfo } from '../ncqp/ncqp.types';
import { NcqpSession } from './session';

function fmtDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly ncqp: NcqpService) {}

  /** Exchange credentials for a session. Credentials are not retained. */
  async login(username: string, password: string): Promise<NcqpSession> {
    const token = await this.ncqp.login(username, password);
    const info = AuthService.parseUserInfo(token.UserInfo);

    const userId = info.WebUserId != null ? String(info.WebUserId) : String(info.UserID ?? '');
    let accountId = info.AccountID != null ? String(info.AccountID) : '';

    // Fallback: derive account number from the overview if UserInfo lacked it.
    if (!accountId) {
      try {
        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - 7);
        const overview = await this.ncqp.getAccountOverview(
          token.access_token,
          fmtDate(from),
          fmtDate(to),
        );
        if (overview.accountNumber != null) accountId = String(overview.accountNumber);
      } catch {
        this.logger.warn('Could not resolve account number from overview');
      }
    }

    if (!userId || !accountId) {
      throw new UnauthorizedException('Login succeeded but account context was incomplete');
    }

    const expiresInSec = typeof token.expires_in === 'number' ? token.expires_in : 3599;
    return {
      token: token.access_token,
      userId,
      accountId,
      exp: Date.now() + expiresInSec * 1000,
    };
  }

  static parseUserInfo(raw: string | undefined): NcqpUserInfo {
    if (!raw) return {};
    try {
      return JSON.parse(raw) as NcqpUserInfo;
    } catch {
      return {};
    }
  }
}
