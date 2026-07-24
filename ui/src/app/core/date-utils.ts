/** Small, generic date helpers shared across the dashboard components. */

/** True when two dates (Date or ISO string) fall on the same local calendar day. */
export function isSameDay(a: Date | string, b: Date | string): boolean {
  const da = a instanceof Date ? a : new Date(a);
  const db = b instanceof Date ? b : new Date(b);
  return da.toDateString() === db.toDateString();
}

/** A copy of the given date at the last millisecond of its local day. */
export function endOfDay(d: Date): Date {
  const e = new Date(d);
  e.setHours(23, 59, 59, 999);
  return e;
}

/**
 * A copy of the given date at the last millisecond of its week's Sunday. Weeks
 * run Monday–Sunday (matching the weekly HOV schedule), so on a Sunday this is
 * the end of that same day.
 */
export function endOfWeek(d: Date): Date {
  const e = endOfDay(d);
  const daysUntilSunday = (7 - e.getDay()) % 7; // getDay: 0=Sun..6=Sat
  e.setDate(e.getDate() + daysUntilSunday);
  return e;
}
