/** A single account transaction (toll or replenishment) row. */
export interface NcqpTransaction {
  activityType?: number;
  activityTypeName?: string;
  exitLocation?: string;
  transactionDate?: string;
  transactionDisplayDateFormatted?: string;
  tagNumber?: string;
  debitAmount?: number;
  creditAmount?: number | null;
  formatDebitAmount?: string;
  balanceAmount?: number;
  transactionType?: string;
  custTrxnTypeID?: string;
  class?: string;
  axles?: number;
  total?: number;
  /** Ledger id for the row; the key `AddCase` attaches to a dispute. */
  detailTransactionID?: string;
  /** Set when the toll was charged as an HOV occupancy violation. */
  hovViolation?: boolean;
  violationComments?: string;
  [key: string]: unknown;
}
