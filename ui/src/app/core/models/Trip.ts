import { TransactionView } from './TransactionView';

/** A group of tolls (one road group) that occurred within the grouping window. */
export interface Trip {
  start: string;
  end: string;
  total: number;
  /** Road group id these tolls belong to, or null when unclassified ("Other"). */
  roadGroup: string | null;
  /** Display label for the road group, or "Other" when unclassified. */
  roadGroupLabel: string;
  /** True when any toll in the trip is disputable (paid HOV toll in a declared window). */
  disputable: boolean;
  transactions: TransactionView[];
}
