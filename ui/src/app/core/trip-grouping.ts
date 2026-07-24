import { TransactionView } from './models/TransactionView';
import { Trip } from './models/Trip';

/** Label for tolls that don't belong to a known road group. */
export const OTHER_ROAD_LABEL = 'Other';

function isToll(t: TransactionView): boolean {
  return (t.activityTypeName ?? '').toLowerCase() === 'toll';
}

function toMillis(iso: string): number {
  return new Date(iso).getTime();
}

function makeTrip(
  transactions: TransactionView[],
  labelFor: (roadGroup: string | null) => string,
): Trip {
  const total = transactions.reduce((sum, t) => sum + (t.debitAmount || 0), 0);
  const roadGroup = transactions[0].roadGroup;
  return {
    start: transactions[0].transactionDate,
    end: transactions[transactions.length - 1].transactionDate,
    total: Math.round(total * 100) / 100,
    roadGroup,
    roadGroupLabel: labelFor(roadGroup),
    disputable: transactions.some((t) => t.disputable),
    violation: transactions.some((t) => t.hovViolation),
    transactions,
  };
}

/**
 * Group toll transactions into trips: consecutive tolls in the same road group,
 * no more than `gapMinutes` apart, belong to the same trip. A gap over the window
 * OR a change of road group starts a new trip. Non-toll rows are ignored. Returned
 * newest-trip-first. `roadGroupLabels` maps a road group id to its display label.
 */
export function groupIntoTrips(
  transactions: TransactionView[],
  roadGroupLabels: Map<string, string> = new Map(),
  gapMinutes = 5,
): Trip[] {
  const labelFor = (roadGroup: string | null): string =>
    roadGroup === null ? OTHER_ROAD_LABEL : (roadGroupLabels.get(roadGroup) ?? roadGroup);

  const tolls = transactions
    .filter((t) => isToll(t) && !!t.transactionDate)
    .slice()
    .sort((a, b) => toMillis(a.transactionDate) - toMillis(b.transactionDate));

  const gapMs = gapMinutes * 60 * 1000;
  const trips: Trip[] = [];
  let current: TransactionView[] = [];
  let lastMs = 0;
  let currentGroup: string | null = null;

  for (const t of tolls) {
    const ms = toMillis(t.transactionDate);
    const group = t.roadGroup ?? null;
    if (current.length > 0 && (ms - lastMs > gapMs || group !== currentGroup)) {
      trips.push(makeTrip(current, labelFor));
      current = [];
    }
    current.push(t);
    lastMs = ms;
    currentGroup = group;
  }
  if (current.length > 0) {
    trips.push(makeTrip(current, labelFor));
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
