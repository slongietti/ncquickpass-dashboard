import { Injectable } from '@nestjs/common';
import { NcqpService } from '../ncqp/ncqp.service';
import { DbClient } from '../../database/db-client';
import { RoadGroupService } from '../../roads/road-group.service';
import { DeclarationStatus } from '../schedule/schedule.constants';
import { NcqpTransaction } from '../../models/ncqp/ncqp.types';
import { NcqpSession } from '../auth/session/session';

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
  /** Road group id for this toll's exit location, or null if unclassified. */
  roadGroup: string | null;
  /** A paid HOV-eligible toll that fell inside a recorded HOV declaration window. */
  disputable: boolean;
}

/** A recorded declaration window as milliseconds, for point-in-window checks. */
interface WindowMs {
  start: number;
  end: number;
}

const PAGE_SIZE = 100;
const MAX_PAGES = 300; // hard backstop: up to 30,000 rows (covers "Forever")

function fmtDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

@Injectable()
export class TransactionsService {
  constructor(
    private readonly ncqp: NcqpService,
    private readonly db: DbClient,
    private readonly roads: RoadGroupService,
  ) {}

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

    const views = rows.map((t) => this.toView(t));
    await this.markDisputable(session.accountId, views);
    return views;
  }

  /**
   * Flag paid HOV-eligible tolls that occurred inside a recorded HOV declaration
   * window for the same transponder — i.e. you declared HOV yet were charged.
   * Matches against the ledger only (declarations this app created); tolls with
   * no recorded window are left un-flagged.
   */
  private async markDisputable(accountId: string, views: TransactionView[]): Promise<void> {
    const candidates = views.filter(
      (v) => v.debitAmount > 0 && !!v.transactionDate && this.roads.isHovEligible(v.exitLocation),
    );
    if (candidates.length === 0) return;

    let from = Number.POSITIVE_INFINITY;
    let to = Number.NEGATIVE_INFINITY;
    for (const v of candidates) {
      const t = new Date(v.transactionDate).getTime();
      if (t < from) from = t;
      if (t > to) to = t;
    }

    const windows = await this.db.hOVDeclaration.findMany({
      where: {
        accountId,
        status: DeclarationStatus.Materialized,
        windowStart: { lte: new Date(to) },
        windowEnd: { gte: new Date(from) },
      },
      select: { transponderNumber: true, windowStart: true, windowEnd: true },
    });
    if (windows.length === 0) return;

    const byTag = new Map<string, WindowMs[]>();
    for (const w of windows) {
      const list = byTag.get(w.transponderNumber) ?? [];
      list.push({ start: w.windowStart.getTime(), end: w.windowEnd.getTime() });
      byTag.set(w.transponderNumber, list);
    }

    for (const v of candidates) {
      const t = new Date(v.transactionDate).getTime();
      const forTag = byTag.get(v.tagNumber);
      if (forTag?.some((w) => w.start <= t && t <= w.end)) {
        v.disputable = true;
      }
    }
  }

  private toView(t: NcqpTransaction): TransactionView {
    const exitLocation = t.exitLocation ?? '';
    return {
      activityTypeName: t.activityTypeName ?? '',
      exitLocation,
      transactionDate: t.transactionDate ?? '',
      transactionDisplayDate: t.transactionDisplayDateFormatted ?? '',
      tagNumber: t.tagNumber ?? '',
      debitAmount: typeof t.debitAmount === 'number' ? t.debitAmount : 0,
      creditAmount: typeof t.creditAmount === 'number' ? t.creditAmount : null,
      transactionType: t.transactionType ?? '',
      vehicleClass: t.class ?? '',
      roadGroup: this.roads.classify(exitLocation)?.id ?? null,
      disputable: false,
    };
  }
}
