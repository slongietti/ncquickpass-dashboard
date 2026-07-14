import { Injectable } from '@nestjs/common';
import { NcqpService } from '../ncqp/ncqp.service';
import { NcqpTransaction } from '../ncqp/ncqp.types';
import { NcqpSession } from '../auth/session';

/** Slim transaction shape returned to the SPA. */
export interface TransactionView {
  activityTypeName: string;
  exitLocation: string;
  transactionDate: string;
  transactionDisplayDate: string;
  tagNumber: string;
  debitAmount: number;
  creditAmount: number | null;
  transactionType: string;
  vehicleClass: string;
}

const PAGE_SIZE = 100;
const MAX_PAGES = 50; // hard backstop: up to 5,000 rows

function fmtDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

@Injectable()
export class TransactionsService {
  constructor(private readonly ncqp: NcqpService) {}

  /** Fetch every transaction in the last `days`, following pagination. */
  async search(session: NcqpSession, days: number): Promise<TransactionView[]> {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    const startDate = fmtDate(start);
    const endDate = fmtDate(end);

    const rows: NcqpTransaction[] = [];
    let skip = 0;
    let total = Number.POSITIVE_INFINITY;
    for (let page = 0; page < MAX_PAGES && skip < total; page++) {
      const batch = await this.ncqp.searchTransactions(
        session.token,
        startDate,
        endDate,
        skip,
        PAGE_SIZE,
      );
      if (batch.length === 0) break;
      rows.push(...batch);
      total = typeof batch[0].total === 'number' ? (batch[0].total as number) : rows.length;
      skip += PAGE_SIZE;
      if (batch.length < PAGE_SIZE) break;
    }

    return rows.map(TransactionsService.toView);
  }

  private static toView(t: NcqpTransaction): TransactionView {
    return {
      activityTypeName: t.activityTypeName ?? '',
      exitLocation: t.exitLocation ?? '',
      transactionDate: t.transactionDate ?? '',
      transactionDisplayDate: t.transactionDisplayDateFormatted ?? '',
      tagNumber: t.tagNumber ?? '',
      debitAmount: typeof t.debitAmount === 'number' ? t.debitAmount : 0,
      creditAmount: typeof t.creditAmount === 'number' ? t.creditAmount : null,
      transactionType: t.transactionType ?? '',
      vehicleClass: t.class ?? '',
    };
  }
}
