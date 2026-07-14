import { TransactionView, Trip } from './models';

/** Substring (case-insensitive) that marks an I-77 Express Lanes exit. */
export const HOV_ROUTE_MARKER = '77 el';

/** True when the exit location identifies an I-77 Express Lanes (HOV) toll. */
export function isHovRoute(exitLocation: string | null | undefined): boolean {
  return (exitLocation ?? '').toLowerCase().includes(HOV_ROUTE_MARKER);
}

function isToll(t: TransactionView): boolean {
  return (t.activityTypeName ?? '').toLowerCase() === 'toll';
}

function toMillis(iso: string): number {
  return new Date(iso).getTime();
}

function makeTrip(transactions: TransactionView[]): Trip {
  const total = transactions.reduce((sum, t) => sum + (t.debitAmount || 0), 0);
  return {
    start: transactions[0].transactionDate,
    end: transactions[transactions.length - 1].transactionDate,
    total: Math.round(total * 100) / 100,
    transactions,
  };
}

/**
 * Group I-77 HOV tolls into trips: consecutive tolls no more than `gapMinutes`
 * apart belong to the same trip. Non-toll and non-HOV rows are ignored.
 * Returned newest-trip-first.
 */
export function groupIntoTrips(
  transactions: TransactionView[],
  gapMinutes = 5,
): Trip[] {
  const tolls = transactions
    .filter((t) => isToll(t) && isHovRoute(t.exitLocation) && !!t.transactionDate)
    .slice()
    .sort((a, b) => toMillis(a.transactionDate) - toMillis(b.transactionDate));

  const gapMs = gapMinutes * 60 * 1000;
  const trips: Trip[] = [];
  let current: TransactionView[] = [];
  let lastMs = 0;

  for (const t of tolls) {
    const ms = toMillis(t.transactionDate);
    if (current.length > 0 && ms - lastMs > gapMs) {
      trips.push(makeTrip(current));
      current = [];
    }
    current.push(t);
    lastMs = ms;
  }
  if (current.length > 0) {
    trips.push(makeTrip(current));
  }

  return trips.reverse();
}
