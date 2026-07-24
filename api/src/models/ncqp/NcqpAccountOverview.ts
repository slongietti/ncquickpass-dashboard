/** Account overview summary (balance, status) for a date range. */
export interface NcqpAccountOverview {
  accountNumber?: string | number;
  currentBalance?: number;
  accountStatus?: string;
  [key: string]: unknown;
}
