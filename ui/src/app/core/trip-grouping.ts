import { TransactionView, Trip } from './models';

/** Substring (case-insensitive) that marks an I-77 Express Lanes exit. */
export const HOV_ROUTE_MARKER = '77 el';

export const HIGHWAY_I77 = 'I-77';
export const HIGHWAY_OTHER = 'Other';

/** True when the exit location identifies an I-77 Express Lanes (HOV) toll. */
export function isHovRoute(exitLocation: string | null | undefined): boolean {
  return (exitLocation ?? '').toLowerCase().includes(HOV_ROUTE_MARKER);
}

/** Classify a toll's highway. Everything that isn't I-77 is "Other". */
export function highwayOf(exitLocation: string | null | undefined): string {
  return isHovRoute(exitLocation) ? HIGHWAY_I77 : HIGHWAY_OTHER;
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
    highway: highwayOf(transactions[0].exitLocation),
    transactions,
  };
}

/**
 * Group toll transactions into trips: consecutive tolls on the same highway, no
 * more than `gapMinutes` apart, belong to the same trip. A gap over the window
 * OR a change of highway starts a new trip. Non-toll rows are ignored.
 * Returned newest-trip-first.
 */
export function groupIntoTrips(
  transactions: TransactionView[],
  gapMinutes = 5,
): Trip[] {
  const tolls = transactions
    .filter((t) => isToll(t) && !!t.transactionDate)
    .slice()
    .sort((a, b) => toMillis(a.transactionDate) - toMillis(b.transactionDate));

  const gapMs = gapMinutes * 60 * 1000;
  const trips: Trip[] = [];
  let current: TransactionView[] = [];
  let lastMs = 0;
  let currentHighway: string | null = null;

  for (const t of tolls) {
    const ms = toMillis(t.transactionDate);
    const highway = highwayOf(t.exitLocation);
    if (current.length > 0 && (ms - lastMs > gapMs || highway !== currentHighway)) {
      trips.push(makeTrip(current));
      current = [];
    }
    current.push(t);
    lastMs = ms;
    currentHighway = highway;
  }
  if (current.length > 0) {
    trips.push(makeTrip(current));
  }

  return trips.reverse();
}

/** Replenishment (add-money) activities, newest first. */
export function replenishments(transactions: TransactionView[]): TransactionView[] {
  return transactions
    .filter((t) => (t.activityTypeName ?? '').toLowerCase() === 'replenish')
    .slice()
    .sort((a, b) => toMillis(b.transactionDate) - toMillis(a.transactionDate));
}
