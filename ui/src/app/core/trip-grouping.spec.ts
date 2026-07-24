import { TransactionView } from './models/TransactionView';
import { groupIntoTrips, replenishments } from './trip-grouping';

function toll(overrides: Partial<TransactionView>): TransactionView {
  return {
    activityTypeName: 'Toll',
    exitLocation: 'Toll Plaza A',
    transactionDate: '2026-07-11T10:00:00',
    transactionDisplayDate: '',
    tagNumber: '03301285570',
    debitAmount: 1.0,
    creditAmount: null,
    transactionType: 'Toll Charge',
    vehicleClass: '1',
    roadGroup: 'road-a',
    disputable: false,
    detailTransactionID: '',
    hovViolation: false,
    violationComments: '',
    ...overrides,
  };
}

const LABELS = new Map([['road-a', 'Road A']]);

describe('groupIntoTrips', () => {
  it('groupIntoTrips_withTollsWithinFiveMinutes_returnsSingleTrip', () => {
    const txns = [
      toll({ transactionDate: '2026-07-11T10:00:00', debitAmount: 1.0 }),
      toll({ transactionDate: '2026-07-11T10:03:00', debitAmount: 1.5 }),
      toll({ transactionDate: '2026-07-11T10:06:00', debitAmount: 2.0 }),
    ];
    const trips = groupIntoTrips(txns, LABELS);
    expect(trips.length).toBe(1);
    expect(trips[0].transactions.length).toBe(3);
    expect(trips[0].total).toBe(4.5);
    expect(trips[0].roadGroup).toBe('road-a');
    expect(trips[0].roadGroupLabel).toBe('Road A');
  });

  it('groupIntoTrips_withGapOverFiveMinutes_startsNewTrip', () => {
    const txns = [
      toll({ transactionDate: '2026-07-11T10:00:00' }),
      toll({ transactionDate: '2026-07-11T10:03:00' }),
      toll({ transactionDate: '2026-07-11T10:20:00' }),
    ];
    expect(groupIntoTrips(txns, LABELS).length).toBe(2);
  });

  it('groupIntoTrips_multipleTrips_returnsNewestFirst', () => {
    const txns = [
      toll({ transactionDate: '2026-07-10T08:00:00' }),
      toll({ transactionDate: '2026-07-12T09:00:00' }),
    ];
    const trips = groupIntoTrips(txns, LABELS);
    expect(trips.length).toBe(2);
    expect(trips[0].start).toBe('2026-07-12T09:00:00');
  });

  it('groupIntoTrips_withDifferentRoadGroupsInWindow_splitsByGroup', () => {
    const txns = [
      toll({ roadGroup: 'road-a', transactionDate: '2026-07-11T10:00:00' }),
      toll({ roadGroup: null, transactionDate: '2026-07-11T10:02:00' }),
    ];
    const trips = groupIntoTrips(txns, LABELS);
    expect(trips.length).toBe(2);
    expect(trips.map((t) => t.roadGroupLabel).sort()).toEqual(['Other', 'Road A']);
  });

  it('groupIntoTrips_withUnclassifiedTolls_labelsThemOther', () => {
    const trips = groupIntoTrips([toll({ roadGroup: null })], LABELS);
    expect(trips.length).toBe(1);
    expect(trips[0].roadGroup).toBeNull();
    expect(trips[0].roadGroupLabel).toBe('Other');
  });

  it('groupIntoTrips_ignoresReplenishRows', () => {
    const txns = [
      toll({ transactionDate: '2026-07-11T10:00:00' }),
      toll({ activityTypeName: 'Replenish', transactionDate: '2026-07-11T10:02:00' }),
    ];
    const trips = groupIntoTrips(txns, LABELS);
    expect(trips.length).toBe(1);
    expect(trips[0].transactions.length).toBe(1);
  });

  it('groupIntoTrips_boundaryExactlyFiveMinutes_staysSingleTrip', () => {
    const txns = [
      toll({ transactionDate: '2026-07-11T10:00:00' }),
      toll({ transactionDate: '2026-07-11T10:05:00' }),
    ];
    expect(groupIntoTrips(txns, LABELS).length).toBe(1);
  });

  it('groupIntoTrips_withAnyDisputableToll_marksTripDisputable', () => {
    const txns = [
      toll({ transactionDate: '2026-07-11T10:00:00', disputable: true }),
      toll({ transactionDate: '2026-07-11T10:03:00' }),
    ];
    expect(groupIntoTrips(txns, LABELS)[0].disputable).toBe(true);
  });

  it('groupIntoTrips_noDisputableTolls_tripNotDisputable', () => {
    expect(groupIntoTrips([toll({})], LABELS)[0].disputable).toBe(false);
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
