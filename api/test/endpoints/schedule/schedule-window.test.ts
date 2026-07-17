import {
  computeWindows,
  ComputeWindowsInput,
} from '../../../src/endpoints/schedule/schedule-window';

const TZ = 'America/New_York';
// Wednesday 08:00 America/New_York (EDT, UTC-4) in summer.
const SUMMER_NOW = new Date('2026-07-15T12:00:00Z');

function input(partial: Partial<ComputeWindowsInput>): ComputeWindowsInput {
  return { days: [], timezone: TZ, horizonDays: 0, ...partial };
}

describe('computeWindows', () => {
  it('computeWindows_multipleRanges_returnsWindowPerRange', () => {
    const windows = computeWindows(
      input({
        days: [
          {
            dayOfWeek: 3, // Wednesday
            allDay: false,
            ranges: [
              { startMinute: 600, endMinute: 720 }, // 10:00-12:00
              { startMinute: 800, endMinute: 900 }, // 13:20-15:00
            ],
          },
        ],
      }),
      SUMMER_NOW,
    );
    expect(windows).toHaveLength(2);
  });

  it('computeWindows_allDay_returnsFullDayWindow', () => {
    const windows = computeWindows(
      input({
        days: [{ dayOfWeek: 4, allDay: true, ranges: [] }], // Thursday
        horizonDays: 2,
      }),
      SUMMER_NOW,
    );
    expect(windows).toHaveLength(1);
    expect(windows[0].end.getTime() - windows[0].start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('computeWindows_pastRange_excluded', () => {
    const windows = computeWindows(
      input({
        days: [{ dayOfWeek: 3, allDay: false, ranges: [{ startMinute: 300, endMinute: 420 }] }], // 05:00-07:00, already over
      }),
      SUMMER_NOW,
    );
    expect(windows).toHaveLength(0);
  });

  it('computeWindows_startWithinLeadTime_pushesStartToNowPlusLead', () => {
    const windows = computeWindows(
      input({
        days: [{ dayOfWeek: 3, allDay: false, ranges: [{ startMinute: 481, endMinute: 600 }] }], // 08:01, 1 min from now
      }),
      SUMMER_NOW,
    );
    expect(windows).toHaveLength(1);
    // now (12:00:00Z) + 15 min lead
    expect(windows[0].start.toISOString()).toBe('2026-07-15T12:15:00.000Z');
  });

  it('computeWindows_respectsDaylightSaving_usesStandardOffsetInWinter', () => {
    // Wednesday 07:00 EST (UTC-5) in winter.
    const winterNow = new Date('2026-01-14T12:00:00Z');
    const windows = computeWindows(
      input({
        days: [{ dayOfWeek: 3, allDay: false, ranges: [{ startMinute: 600, endMinute: 720 }] }], // 10:00 EST
      }),
      winterNow,
    );
    expect(windows[0].start.toISOString()).toBe('2026-01-14T15:00:00.000Z'); // 10:00 EST = 15:00 UTC
  });
});
