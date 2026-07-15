import { TransactionView } from './TransactionView';

/** A group of tolls (one highway) that occurred within the grouping window. */
export interface Trip {
  start: string;
  end: string;
  total: number;
  highway: string;
  transactions: TransactionView[];
}
