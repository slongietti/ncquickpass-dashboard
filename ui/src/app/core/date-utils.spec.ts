import { endOfDay, endOfWeek, isSameDay } from './date-utils';

describe('date-utils', () => {
  describe('isSameDay', () => {
    it('isSameDay_sameCalendarDay_returnsTrue', () => {
      expect(isSameDay('2026-07-17T01:00:00', '2026-07-17T23:00:00')).toBe(true);
    });

    it('isSameDay_acrossMidnight_returnsFalse', () => {
      expect(isSameDay('2026-07-17T23:59:00', '2026-07-18T00:01:00')).toBe(false);
    });

    it('isSameDay_mixedDateAndString_comparesByCalendarDay', () => {
      const morning = new Date(2026, 6, 17, 8, 0);
      expect(isSameDay(morning, '2026-07-17T20:00:00')).toBe(true);
      expect(isSameDay(morning, '2026-07-18T08:00:00')).toBe(false);
    });
  });

  describe('endOfDay', () => {
    it('endOfDay_anyTime_returnsLastMillisecondOfDay', () => {
      const e = endOfDay(new Date(2026, 6, 17, 8, 30));
      expect(e.getHours()).toBe(23);
      expect(e.getMinutes()).toBe(59);
      expect(e.getSeconds()).toBe(59);
      expect(e.getMilliseconds()).toBe(999);
    });

    it('endOfDay_anyTime_keepsSameCalendarDay', () => {
      const d = new Date(2026, 6, 17, 8, 30);
      expect(isSameDay(endOfDay(d), d)).toBe(true);
    });

    it('endOfDay_called_doesNotMutateInput', () => {
      const d = new Date(2026, 6, 17, 8, 30);
      endOfDay(d);
      expect(d.getHours()).toBe(8);
      expect(d.getMinutes()).toBe(30);
    });
  });

  describe('endOfWeek', () => {
    it('endOfWeek_midweek_returnsEndOfComingSunday', () => {
      // 2026-07-15 is a Wednesday; its Mon–Sun week ends Sunday 2026-07-19.
      const e = endOfWeek(new Date(2026, 6, 15, 10, 0));
      expect(e.getMonth()).toBe(6);
      expect(e.getDate()).toBe(19);
      expect(e.getDay()).toBe(0); // Sunday
      expect(e.getHours()).toBe(23);
      expect(e.getMinutes()).toBe(59);
      expect(e.getSeconds()).toBe(59);
      expect(e.getMilliseconds()).toBe(999);
    });

    it('endOfWeek_onSunday_returnsEndOfSameDay', () => {
      // 2026-07-19 is a Sunday, so the rest of the week is the rest of that day.
      const e = endOfWeek(new Date(2026, 6, 19, 9, 0));
      expect(e.getDate()).toBe(19);
      expect(e.getHours()).toBe(23);
    });

    it('endOfWeek_onMonday_returnsEndOfThatWeeksSunday', () => {
      // 2026-07-13 is a Monday; the week ends Sunday 2026-07-19.
      const e = endOfWeek(new Date(2026, 6, 13, 6, 0));
      expect(e.getDate()).toBe(19);
      expect(e.getDay()).toBe(0);
    });

    it('endOfWeek_called_doesNotMutateInput', () => {
      const d = new Date(2026, 6, 15, 10, 0);
      endOfWeek(d);
      expect(d.getDate()).toBe(15);
      expect(d.getHours()).toBe(10);
    });
  });
});
