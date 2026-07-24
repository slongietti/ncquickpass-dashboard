import { HovService } from '../../../src/endpoints/hov/hov.service';
import { DbClient } from '../../../src/database/db-client';
import { NcqpAccountClient } from '../../../src/endpoints/ncqp/ncqp-account.client';
import { NcqpHovClient } from '../../../src/endpoints/ncqp/ncqp-hov.client';
import { RoadGroupService } from '../../../src/roads/road-group.service';
import { NcqpSession } from '../../../src/endpoints/auth/session/session';
import {
  DeclarationSource,
  DeclarationStatus,
} from '../../../src/endpoints/schedule/schedule.constants';

const SESSION = {
  token: 't',
  userId: 'u',
  accountId: 'ACC',
  username: 'user@example.com',
} as unknown as NcqpSession;

const FIXED = new Date('2026-07-15T12:00:00Z');

function makeMocks() {
  const db = {
    hOVDeclaration: {
      upsert: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const accountClient = { getVehicles: jest.fn().mockResolvedValue([]) };
  const hov = {
    activateHov: jest.fn().mockResolvedValue(111),
    cancelHov: jest.fn().mockResolvedValue('Canceled'),
  };
  const roads = { defaultHovLocation: jest.fn().mockReturnValue('Road A') };
  const service = new HovService(
    accountClient as unknown as NcqpAccountClient,
    hov as unknown as NcqpHovClient,
    db as unknown as DbClient,
    roads as unknown as RoadGroupService,
  );
  return { db, hov, service };
}

describe('HovService.activate', () => {
  beforeAll(() => jest.useFakeTimers({ now: FIXED }));
  afterAll(() => jest.useRealTimers());

  it('activate_customEnd_recordsAdhocDeclarationWithThatEnd', async () => {
    const { hov, db, service } = makeMocks();
    const end = '2026-07-15T20:30:00Z';
    const result = await service.activate(SESSION, {
      transponderNumber: 'TAG1',
      endDateTime: end,
    });

    expect(result).toEqual({ declarationId: 111 });
    expect(hov.activateHov).toHaveBeenCalledWith(
      't',
      expect.objectContaining({
        option: 'DateInTheFuture',
        endDateTime: new Date(end).toISOString(),
      }),
    );
    expect(db.hOVDeclaration.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: {
          accountId: 'ACC',
          scheduleId: null,
          source: DeclarationSource.Adhoc,
          transponderNumber: 'TAG1',
          windowStart: FIXED,
          windowEnd: new Date(end),
          ncqpDeclarationId: '111',
          status: DeclarationStatus.Materialized,
        },
      }),
    );
  });

  it('activate_noEnd_recordsRestOfTodayAsEasternEndOfDay', async () => {
    const { hov, db, service } = makeMocks();
    await service.activate(SESSION, { transponderNumber: 'TAG1' });

    expect(hov.activateHov).toHaveBeenCalledWith(
      't',
      expect.objectContaining({ option: 'RestOfToday', endDateTime: null }),
    );
    // 2026-07-15 in America/New_York (EDT, -04:00) ends at 23:59:59.999 local = 03:59:59.999Z UTC.
    expect(db.hOVDeclaration.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: {
          accountId: 'ACC',
          scheduleId: null,
          source: DeclarationSource.Adhoc,
          transponderNumber: 'TAG1',
          windowStart: FIXED,
          windowEnd: new Date('2026-07-16T03:59:59.999Z'),
          ncqpDeclarationId: '111',
          status: DeclarationStatus.Materialized,
        },
      }),
    );
  });

  it('activate_dbWriteFails_stillReturnsDeclarationId', async () => {
    const { db, service } = makeMocks();
    db.hOVDeclaration.upsert.mockRejectedValueOnce(new Error('db down'));
    const result = await service.activate(SESSION, {
      transponderNumber: 'TAG1',
    });
    expect(result).toEqual({ declarationId: 111 });
  });
});

describe('HovService.cancel', () => {
  it('cancel_matchingNcqpId_marksRecordedRowCanceled', async () => {
    const { hov, db, service } = makeMocks();
    const result = await service.cancel(SESSION, '999');

    expect(hov.cancelHov).toHaveBeenCalledWith('t', '999', 'u');
    expect(db.hOVDeclaration.updateMany).toHaveBeenCalledWith({
      where: {
        accountId: 'ACC',
        ncqpDeclarationId: '999',
        status: DeclarationStatus.Materialized,
      },
      data: { status: DeclarationStatus.Canceled },
    });
    expect(result).toEqual({ result: 'Canceled' });
  });

  it('cancel_dbSyncFails_stillReturnsNcqpResult', async () => {
    const { db, service } = makeMocks();
    db.hOVDeclaration.updateMany.mockRejectedValueOnce(
      new Error('db down'),
    );
    const result = await service.cancel(SESSION, '999');
    expect(result).toEqual({ result: 'Canceled' });
  });
});
