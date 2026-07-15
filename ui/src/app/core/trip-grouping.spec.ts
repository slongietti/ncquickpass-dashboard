import { TransactionView } from './models/TransactionView';
import { groupIntoTrips, highwayOf, isHovRoute, replenishments } from './trip-grouping';

function toll(overrides: Partial<TransactionView>): TransactionView {
  return {
    activityTypeName: 'Toll',
    exitLocation: 'I-77 EL Exit 1',
    transactionDate: '2026-07-11T10:00:00',
    transactionDisplayDate: '',
    tagNumber: '03301285570',
    debitAmount: 1.0,
    creditAmount: null,
    transactionType: 'Toll Charge',
    vehicleClass: '1',
    ...overrides,
  };
}

describe('isHovRoute / highwayOf', () => {
  it('isHovRoute_withMarkerPresent_returnsTrue', () => {
    expect(isHovRoute('I-77 EL Exit 28')).toBe(true);
    expect(isHovRoute('77 el gilead')).toBe(true);
  });

  it('isHovRoute_withoutMarker_returnsFalse', () => {
    expect(isHovRoute('Ghent South / AS')).toBe(false);
    expect(isHovRoute('')).toBe(false);
    expect(isHovRoute(null)).toBe(false);
  });

  it('highwayOf_withI77Exit_returnsI77_otherwiseOther', () => {
    expect(highwayOf('I-77 EL Exit 16')).toBe('I-77');
    expect(highwayOf('Ghent South / AS')).toBe('Other');
  });
});

describe('groupIntoTrips', () => {
  it('groupIntoTrips_withTollsWithinFiveMinutes_returnsSingleTrip', () => {
    const txns = [
      toll({ transactionDate: '2026-07-11T10:00:00', debitAmount: 1.0 }),
      toll({ transactionDate: '2026-07-11T10:03:00', debitAmount: 1.5 }),
      toll({ transactionDate: '2026-07-11T10:06:00', debitAmount: 2.0 }),
    ];
    const trips = groupIntoTrips(txns);
    expect(trips.length).toBe(1);
    expect(trips[0].transactions.length).toBe(3);
    expect(trips[0].total).toBe(4.5);
    expect(trips[0].highway).toBe('I-77');
  });

  it('groupIntoTrips_withGapOverFiveMinutes_startsNewTrip', () => {
    const txns = [
      toll({ transactionDate: '2026-07-11T10:00:00' }),
      toll({ transactionDate: '2026-07-11T10:03:00' }),
      toll({ transactionDate: '2026-07-11T10:20:00' }),
    ];
    expect(groupIntoTrips(txns).length).toBe(2);
  });

  it('groupIntoTrips_multipleTrips_returnsNewestFirst', () => {
    const txns = [
      toll({ transactionDate: '2026-07-10T08:00:00' }),
      toll({ transactionDate: '2026-07-12T09:00:00' }),
    ];
    const trips = groupIntoTrips(txns);
    expect(trips.length).toBe(2);
    expect(trips[0].start).toBe('2026-07-12T09:00:00');
  });

  it('groupIntoTrips_withDifferentHighwaysInWindow_splitsByHighway', () => {
    const txns = [
      toll({ exitLocation: 'I-77 EL Exit 1', transactionDate: '2026-07-11T10:00:00' }),
      toll({ exitLocation: 'Ghent South / AS', transactionDate: '2026-07-11T10:02:00' }),
    ];
    const trips = groupIntoTrips(txns);
    expect(trips.length).toBe(2);
    expect(trips.map((t) => t.highway).sort()).toEqual(['I-77', 'Other']);
  });

  it('groupIntoTrips_withNonI77Tolls_includesThemAsOther', () => {
    const txns = [toll({ exitLocation: 'Ghent South / AS' })];
    const trips = groupIntoTrips(txns);
    expect(trips.length).toBe(1);
    expect(trips[0].highway).toBe('Other');
  });

  it('groupIntoTrips_ignoresReplenishRows', () => {
    const txns = [
      toll({ transactionDate: '2026-07-11T10:00:00' }),
      toll({ activityTypeName: 'Replenish', transactionDate: '2026-07-11T10:02:00' }),
    ];
    const trips = groupIntoTrips(txns);
    expect(trips.length).toBe(1);
    expect(trips[0].transactions.length).toBe(1);
  });

  it('groupIntoTrips_boundaryExactlyFiveMinutes_staysSingleTrip', () => {
    const txns = [
      toll({ transactionDate: '2026-07-11T10:00:00' }),
      toll({ transactionDate: '2026-07-11T10:05:00' }),
    ];
    expect(groupIntoTrips(txns).length).toBe(1);
  });
});

describe('replenishments', () => {
  it('replenishments_returnsOnlyReplenishNewestFirst', () => {
    const txns = [
      toll({ transactionDate: '2026-07-11T10:00:00' }),
      toll({
        activityTypeName: 'Replenish',
        transactionDate: '2026-07-05T08:00:00',
        creditAmount: 20,
      }),
      toll({
        activityTypeName: 'Replenish',
        transactionDate: '2026-07-12T08:00:00',
        creditAmount: 40,
      }),
    ];
    const result = replenishments(txns);
    expect(result.length).toBe(2);
    expect(result[0].creditAmount).toBe(40);
    expect(result[1].creditAmount).toBe(20);
  });
});
