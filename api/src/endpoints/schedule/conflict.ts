export interface Interval {
  start: Date;
  end: Date;
}

/** True when two half-open intervals overlap. Touching edges do not count. */
export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/** The materialized windows that overlap an ad-hoc window. */
export function findConflicts<T extends Interval>(adhoc: Interval, materialized: T[]): T[] {
  return materialized.filter((m) => overlaps(adhoc, m));
}
