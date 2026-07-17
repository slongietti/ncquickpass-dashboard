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
