import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { NcqpAccountClient } from '../ncqp/ncqp-account.client';
import { NcqpCasesClient } from '../ncqp/ncqp-cases.client';
import { NcqpTransactionsClient } from '../ncqp/ncqp-transactions.client';
import { NcqpTransaction } from '../../models/ncqp/NcqpTransaction';
import { NcqpSession } from '../auth/session/session';
import { CreateDisputeDto } from '../../models/tollExceptions/CreateDisputeDto';
import { Dispute, DisputeTransaction, parseDisputes } from './dispute-correspondence';

/** A dispute reason offered to the customer. */
export interface DisputeReasonView {
  reasonId: number;
  label: string;
}

/** Result of filing a dispute. */
export interface CreateDisputeResult {
  caseNumber: string;
  caseId: number;
}

/** A correspondence document ready to stream to the client. */
export interface DisputeDocument {
  data: Buffer;
  contentType: string;
  filename: string;
}

/**
 * Customer-facing dispute reason ids, in display order — the full NCQP list also
 * carries internal/agency-only reasons (IAG, judicial/admin review) we don't
 * offer. The first id is the default the drawer pre-selects.
 */
const CUSTOMER_REASON_IDS = [43, 38, 44, 37, 22, 34, 40];

/** NCQP dispute field values observed via ClickSpec; constant across submissions. */
const DISPUTE_DEFAULTS = {
  priorityLevelID: 2,
  caseStatusId: 1,
  communicationMethodID: 2,
  languagePreference: 0,
  ticketTypeID: 1,
  sourceID: 1,
  biNoticeID: 0,
  updateUserID: 99,
  queueID: 9006,
} as const;

const TOLL_DISPUTE_TOPIC = 'Toll Dispute';
const TOLL_DISPUTE_TOPIC_ID = 63;

/** Tolls precede the case; scan this many days before each dispute's created date. */
const CORRELATE_PRE_DAYS = 120;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Overall cap on GetCaseByTrxn lookups per disputes load. */
const MAX_CASE_LOOKUPS = 120;
/** A dispute matches a case only when their creation times are within this window. */
const MATCH_TOLERANCE_MS = 5 * 60 * 1000;
/** NC Quick Pass is Eastern; correspondence timestamps are local to this zone. */
const NC_ZONE = 'America/New_York';

/** A case's tolls + total, with its creation time for matching to a dispute. */
interface CaseGroup {
  createdMs: number;
  transactions: DisputeTransaction[];
  total: number;
}

@Injectable()
export class TollExceptionsService {
  constructor(
    private readonly account: NcqpAccountClient,
    private readonly cases: NcqpCasesClient,
    private readonly transactions: NcqpTransactionsClient,
  ) {}

  /** The customer's disputes with status/decision, parsed from correspondence. */
  async getDisputes(session: NcqpSession): Promise<Dispute[]> {
    const correspondence = await this.account.searchCorrespondence(session.token, session.accountId);
    const disputes = parseDisputes(correspondence);
    // Best-effort itemization; a correlation hiccup must never fail the disputes list.
    try {
      await this.attachTransactions(session, disputes);
    } catch {
      // leave disputes without itemized tolls
    }
    return disputes;
  }

  /**
   * Attach each dispute's tolls + total. NCQP won't return a case's transactions by
   * the customer-facing case number, so we correlate: for each dispute, scan the
   * tolls in the window BEFORE its creation date (tolls always precede the case),
   * group them into cases via GetCaseByTrxn, and take the case whose createdDate
   * matches the dispute (case createdDate is UTC; the dispute's is NC-local) within
   * 5 minutes, closest wins. The window is driven by each dispute's own date, so
   * historical disputes are covered without a fixed look-back. Bounded + best-effort.
   */
  private async attachTransactions(session: NcqpSession, disputes: Dispute[]): Promise<void> {
    const dated = disputes
      .map((dispute) => ({ dispute, ms: TollExceptionsService.easternToMs(dispute.createdDate) }))
      .filter((x): x is { dispute: Dispute; ms: number } => x.ms != null)
      .sort((a, b) => a.ms - b.ms);
    if (dated.length === 0) return;

    const tollById = new Map<string, NcqpTransaction>();
    const lookedUp = new Set<string>();
    const cases: CaseGroup[] = [];
    let lookups = 0;

    const closest = (ms: number): CaseGroup | null => {
      let best: CaseGroup | null = null;
      let bestDiff = MATCH_TOLERANCE_MS;
      for (const group of cases) {
        if (Number.isNaN(group.createdMs)) continue;
        const diff = Math.abs(group.createdMs - ms);
        if (diff <= bestDiff) {
          best = group;
          bestDiff = diff;
        }
      }
      return best;
    };

    for (const { dispute, ms } of dated) {
      // Only scan if a matching case hasn't already been discovered for another dispute.
      if (!closest(ms) && lookups < MAX_CASE_LOOKUPS) {
        const tolls = await this.tollsInWindow(session, ms - CORRELATE_PRE_DAYS * DAY_MS, ms + DAY_MS);
        for (const toll of tolls) tollById.set(toll.detailTransactionID as string, toll);
        for (const toll of tolls) {
          if (lookups >= MAX_CASE_LOOKUPS) break;
          const id = toll.detailTransactionID as string;
          if (lookedUp.has(id)) continue;
          lookedUp.add(id);
          lookups++;
          const found = await this.cases.getCaseByTrxn(session.token, id);
          const ids = (found?.caseInfos?.caseTabs?.[0]?.data ?? [])
            .map((d) => d.detailTransactionID ?? '')
            .filter((x) => x.length > 0);
          if (ids.length === 0) continue;
          ids.forEach((x) => lookedUp.add(x));
          const transactions = ids
            .map((x) => tollById.get(x))
            .filter((r): r is NcqpTransaction => !!r)
            .map((r) => ({
              exitLocation: r.exitLocation ?? '',
              transactionDate: r.transactionDate ?? '',
              debitAmount: typeof r.debitAmount === 'number' ? r.debitAmount : 0,
            }));
          const total = Math.round(transactions.reduce((sum, t) => sum + t.debitAmount, 0) * 100) / 100;
          const createdMs = Date.parse(found?.caseInfos?.createdDate ?? '');
          cases.push({ createdMs, transactions, total });
          // Found this dispute's case — stop scanning its window.
          if (!Number.isNaN(createdMs) && Math.abs(createdMs - ms) <= MATCH_TOLERANCE_MS) break;
        }
      }
      const match = closest(ms);
      if (match) {
        dispute.transactions = match.transactions;
        dispute.total = match.total;
      }
    }
  }

  /** Tolls (with a ledger id) in a [startMs, endMs] window, for case correlation. */
  private async tollsInWindow(
    session: NcqpSession,
    startMs: number,
    endMs: number,
  ): Promise<NcqpTransaction[]> {
    const rows = await this.transactions.searchTransactions(
      session.token,
      TollExceptionsService.fmtDate(new Date(startMs)),
      TollExceptionsService.fmtDate(new Date(endMs)),
      0,
      500,
    );
    return rows.filter(
      (r) => (r.activityTypeName ?? '').toLowerCase() === 'toll' && !!r.detailTransactionID,
    );
  }

  private static fmtDate(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  /** Interpret a zone-less correspondence timestamp as NC-local; return epoch ms. */
  private static easternToMs(iso: string | null): number | null {
    if (!iso) return null;
    const dt = DateTime.fromISO(iso, { zone: NC_ZONE });
    return dt.isValid ? dt.toMillis() : null;
  }

  /** Customer-selectable dispute reasons (curated, default first). */
  async getReasons(session: NcqpSession): Promise<DisputeReasonView[]> {
    const all = await this.cases.getDisputeReasons(session.token);
    const labelById = new Map(all.map((reason) => [reason.reasonID, reason.reason]));
    return CUSTOMER_REASON_IDS.filter((id) => labelById.has(id)).map((id) => ({
      reasonId: id,
      label: labelById.get(id) as string,
    }));
  }

  /**
   * File a dispute for the selected transactions: open a case (tracer ticket) with
   * the chosen reason + comments, then attach the transactions to it.
   */
  async createDispute(session: NcqpSession, dto: CreateDisputeDto): Promise<CreateDisputeResult> {
    const { token, accountId } = session;

    const caseType = await this.cases.getCaseTypeId(token, 'Account Dispute');
    const topic = caseType.caseTopics.find((t) => t.topicName === TOLL_DISPUTE_TOPIC);
    const reasons = await this.cases.getDisputeReasons(token);
    const reason = reasons.find((r) => r.reasonID === dto.reasonId);

    const ticketNumber = await this.cases.generateTicketNumber(token);
    const caseId = await this.cases.createTracerTicket(token, {
      ticketNumber,
      caseTypeId: caseType.id,
      caseTopicId: topic?.id ?? TOLL_DISPUTE_TOPIC_ID,
      caseTitle: reason?.reason ?? 'Toll dispute',
      reasonID: dto.reasonId,
      accountId,
      notes: `Comments: ${dto.comments}`,
      ...DISPUTE_DEFAULTS,
    });

    await this.cases.addCase(token, {
      id: '',
      accountId,
      caseId,
      caseInfos: {
        createdDate: new Date().toISOString(),
        caseTabs: [
          {
            name: 'Transaction Tab',
            data: dto.detailTransactionIds.map((detailTransactionID) => ({ detailTransactionID })),
          },
        ],
      },
    });

    return { caseNumber: ticketNumber, caseId };
  }

  /** Fetch a correspondence document (e.g. the attached vehicle image) to stream. */
  getDocument(session: NcqpSession, documentId: string): Promise<DisputeDocument> {
    return this.account.getDocumentStream(session.token, documentId);
  }
}
