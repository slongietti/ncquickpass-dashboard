import { DateTime } from 'luxon';

/** NCQP activates a declaration ~15 minutes after it is created. */
export const ACTIVATION_LEAD_MINUTES = 15;

export interface WindowDay {
  dayOfWeek: number; // 0=Sun .. 6=Sat
  allDay: boolean;
  ranges: { startMinute: number; endMinute: number }[];
}

export interface ComputeWindowsInput {
  days: WindowDay[];
  timezone: string;
  horizonDays: number;
}

/** A concrete occurrence to materialize, as an absolute UTC interval. */
export interface MaterializationWindow {
  start: Date;
  end: Date;
}

/** Coerce a stored JSON `ranges` value into typed range objects. */
export function parseRanges(value: unknown): { startMinute: number; endMinute: number }[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (r): r is { startMinute: number; endMinute: number } =>
        !!r && typeof r === 'object' && 'startMinute' in r && 'endMinute' in r,
    )
    .map((r) => ({ startMinute: Number(r.startMinute), endMinute: Number(r.endMinute) }));
}

/**
 * Expand a recurring weekly schedule into concrete UTC windows across the
 * horizon, honoring the schedule's timezone (DST-safe via luxon). Windows that
 * have already ended are dropped; a window starting within the activation lead
 * time is pushed to `now + lead` so NCQP will accept it.
 *
 * Pure and deterministic given `now` — unit-tested in isolation.
 */
export function computeWindows(
  input: ComputeWindowsInput,
  now: Date,
  leadMinutes: number = ACTIVATION_LEAD_MINUTES,
): MaterializationWindow[] {
  const zone = input.timezone || 'America/New_York';
  const nowDt = DateTime.fromJSDate(now, { zone });
  const earliestStart = nowDt.plus({ minutes: leadMinutes });
  const firstDay = nowDt.startOf('day');

  const windows: MaterializationWindow[] = [];
  for (let offset = 0; offset <= input.horizonDays; offset++) {
    const date = firstDay.plus({ days: offset });
    const dayOfWeek = date.weekday % 7; // luxon: Mon=1..Sun=7 -> 0=Sun..6=Sat
    const day = input.days.find((d) => d.dayOfWeek === dayOfWeek);
    if (!day) continue;

    const ranges = day.allDay ? [{ startMinute: 0, endMinute: 24 * 60 }] : day.ranges;
    for (const range of ranges) {
      const end = date.plus({ minutes: range.endMinute });
      if (end <= nowDt) continue; // already over

      let start = date.plus({ minutes: range.startMinute });
      if (start < earliestStart) start = earliestStart; // respect activation lead
      if (start >= end) continue;

      windows.push({ start: start.toUTC().toJSDate(), end: end.toUTC().toJSDate() });
    }
  }
  return windows;
}
