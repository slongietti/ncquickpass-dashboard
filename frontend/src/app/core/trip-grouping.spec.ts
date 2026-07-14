import { TransactionView } from './models';
import { groupIntoTrips, isHovRoute } from './trip-grouping';

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

describe('isHovRoute', () => {
  it('isHovRoute_withMarkerPresent_returnsTrue', () => {
    expect(isHovRoute('I-77 EL Exit 28')).toBe(true);
    expect(isHovRoute('77 el gilead')).toBe(true);
  });

  it('isHovRoute_withoutMarker_returnsFalse', () => {
    expect(isHovRoute('Ghent South / AS')).toBe(false);
    expect(isHovRoute('')).toBe(false);
    expect(isHovRoute(null)).toBe(false);
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
  });

  it('groupIntoTrips_withGapOverFiveMinutes_startsNewTrip', () => {
    const txns = [
      toll({ transactionDate: '2026-07-11T10:00:00' }),
      toll({ transactionDate: '2026-07-11T10:03:00' }),
      toll({ transactionDate: '2026-07-11T10:20:00' }),
    ];
    const trips = groupIntoTrips(txns);
    expect(trips.length).toBe(2);
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

  it('groupIntoTrips_withNonHovAndNonTollRows_ignoresThem', () => {
    const txns = [
      toll({ transactionDate: '2026-07-11T10:00:00' }),
      toll({ exitLocation: 'Ghent South / AS', transactionDate: '2026-07-11T10:01:00' }),
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
