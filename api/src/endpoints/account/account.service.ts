import { Injectable } from '@nestjs/common';
import { NcqpAccountClient } from '../ncqp/ncqp-account.client';
import { NcqpSession } from '../auth/session/session';

export interface AccountSummary {
  accountNumber: string;
  currentBalance: number | null;
  accountStatus: string | null;
}

function fmtDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

@Injectable()
export class AccountService {
  constructor(private readonly ncqp: NcqpAccountClient) {}

  /** Current account balance + status (the "stashed amount"). */
  async getSummary(session: NcqpSession): Promise<AccountSummary> {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 7);
    const overview = await this.ncqp.getAccountOverview(
      session.token,
      fmtDate(from),
      fmtDate(to),
    );
    return {
      accountNumber: String(overview.accountNumber ?? session.accountId),
      currentBalance:
        typeof overview.currentBalance === 'number' ? overview.currentBalance : null,
      accountStatus: overview.accountStatus ?? null,
    };
  }
}
