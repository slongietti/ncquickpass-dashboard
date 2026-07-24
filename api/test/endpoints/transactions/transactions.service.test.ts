import { TransactionsService } from '../../../src/endpoints/transactions/transactions.service';
import { NcqpService } from '../../../src/endpoints/ncqp/ncqp.service';
import { DbClient } from '../../../src/database/db-client';
import { RoadGroupService } from '../../../src/roads/road-group.service';
import { NcqpSession } from '../../../src/endpoints/auth/session/session';
import { NcqpTransaction } from '../../../src/models/ncqp/ncqp.types';

const SESSION = { token: 't', userId: 'u', accountId: 'ACC' } as unknown as NcqpSession;

// A materialized HOV window for TAG1: 2026-07-20 10:00–14:00 UTC.
const WINDOW = {
  transponderNumber: 'TAG1',
  windowStart: new Date('2026-07-20T10:00:00Z'),
  windowEnd: new Date('2026-07-20T14:00:00Z'),
};

function toll(over: Partial<NcqpTransaction>): NcqpTransaction {
  return {
    activityTypeName: 'Toll',
    exitLocation: 'I-77 EL Exit 16',
    transactionDate: '2026-07-20T12:00:00Z',
    tagNumber: 'TAG1',
    debitAmount: 5,
    ...over,
  };
}

const ROAD_GROUPS = [
  { id: 'i77-express', label: 'I-77', keywords: ['77 EL'], hovEligible: true },
];

async function makeService(rows: NcqpTransaction[], windows: unknown[]) {
  const ncqp = { searchTransactions: jest.fn().mockResolvedValue(rows) };
  const db = { hOVDeclaration: { findMany: jest.fn().mockResolvedValue(windows) } };
  const roadsDb = { roadGroup: { findMany: jest.fn().mockResolvedValue(ROAD_GROUPS) } };
  const roads = new RoadGroupService(roadsDb as unknown as DbClient);
  await roads.onModuleInit();
  const service = new TransactionsService(
    ncqp as unknown as NcqpService,
    db as unknown as DbClient,
    roads,
  );
  return { ncqp, db, service };
}

describe('TransactionsService disputable flag', () => {
  it('search_paidI77TollInsideWindow_marksDisputable', async () => {
    const { service } = await makeService([toll({ exitLocation: 'I-77 EL Exit 16' })], [WINDOW]);
    const [view] = await service.search(SESSION, 90);
    expect(view.disputable).toBe(true);
    expect(view.roadGroup).toBe('i77-express');
  });

  it('search_paidI77TollOutsideWindow_notDisputable', async () => {
    const outside = toll({ transactionDate: '2026-07-20T16:00:00Z' }); // after windowEnd
    const { service } = await makeService([outside], [WINDOW]);
    const [view] = await service.search(SESSION, 90);
    expect(view.disputable).toBe(false);
  });

  it('search_freeI77TollInsideWindow_notDisputable', async () => {
    const { service } = await makeService([toll({ debitAmount: 0 })], [WINDOW]);
    const [view] = await service.search(SESSION, 90);
    expect(view.disputable).toBe(false);
  });

  it('search_paidNonHovTollInsideWindow_notDisputable', async () => {
    const { service } = await makeService([toll({ exitLocation: 'Ghent South / AS' })], [WINDOW]);
    const [view] = await service.search(SESSION, 90);
    expect(view.disputable).toBe(false);
    expect(view.roadGroup).toBeNull();
  });

  it('search_paidI77TollDifferentTransponder_notDisputable', async () => {
    const { service } = await makeService([toll({ tagNumber: 'TAG2' })], [WINDOW]);
    const [view] = await service.search(SESSION, 90);
    expect(view.disputable).toBe(false);
  });

  it('search_noRecordedWindows_notDisputable', async () => {
    const { service } = await makeService([toll({})], []);
    const [view] = await service.search(SESSION, 90);
    expect(view.disputable).toBe(false);
  });
});
