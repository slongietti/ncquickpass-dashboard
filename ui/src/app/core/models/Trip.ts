import { TransactionView } from './TransactionView';

/** A group of tolls (one highway) that occurred within the grouping window. */
export interface Trip {
  start: string;
  end: string;
  total: number;
  highway: string;
  /** True when any toll in the trip is disputable (paid HOV toll in a declared window). */
  disputable: boolean;
  transactions: TransactionView[];
}
