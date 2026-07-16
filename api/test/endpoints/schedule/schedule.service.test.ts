import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { PutScheduleDto } from '../../../src/models/schedule/PutScheduleDto';
import { ScheduleService } from '../../../src/endpoints/schedule/schedule.service';

/** Minimal Prisma test double capturing the calls the service makes. */
function makePrismaMock() {
  const tx = {
    weeklySchedule: { upsert: jest.fn().mockResolvedValue({ id: 'sched-1' }) },
    scheduleDay: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }), create: jest.fn() },
  };
  return {
    weeklySchedule: {
      findUnique: jest.fn().mockResolvedValue(null),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    scheduleDay: { create: jest.fn() },
    credential: { count: jest.fn().mockResolvedValue(0) },
    $transaction: jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    _tx: tx,
  };
}

function service(mock: ReturnType<typeof makePrismaMock>): ScheduleService {
  return new ScheduleService(mock as unknown as PrismaService);
}

const ACCOUNT = '86513205';

describe('ScheduleService.getSchedule', () => {
  it('getSchedule_whenNoScheduleExists_returnsDisabledDefault', async () => {
    const mock = makePrismaMock();
    const view = await service(mock).getSchedule(ACCOUNT, 'TAG1');
    expect(view).toMatchObject({ transponderNumber: 'TAG1', enabled: false, days: [] });
    expect(mock.weeklySchedule.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { accountId_transponderNumber: { accountId: ACCOUNT, transponderNumber: 'TAG1' } },
      }),
    );
  });

  it('getSchedule_withStoredSchedule_mapsDaysAndRanges', async () => {
    const mock = makePrismaMock();
    mock.weeklySchedule.findUnique.mockResolvedValue({
      transponderNumber: 'TAG1',
      enabled: true,
      timezone: 'America/New_York',
      horizonDays: 7,
      days: [{ dayOfWeek: 1, allDay: false, ranges: [{ startMinute: 480, endMinute: 600 }] }],
    });
    const view = await service(mock).getSchedule(ACCOUNT, 'TAG1');
    expect(view.enabled).toBe(true);
    expect(view.days[0]).toEqual({
      dayOfWeek: 1,
      allDay: false,
      ranges: [{ startMinute: 480, endMinute: 600 }],
    });
  });

  it('getSchedule_withStoredCredential_setsCredentialOnFile', async () => {
    const mock = makePrismaMock();
    mock.credential.count.mockResolvedValue(1);
    const view = await service(mock).getSchedule(ACCOUNT, 'TAG1');
    expect(view.credentialOnFile).toBe(true);
  });

  it('getSchedule_withoutTransponder_throwsBadRequest', async () => {
    const mock = makePrismaMock();
    await expect(service(mock).getSchedule(ACCOUNT, '')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('ScheduleService.putSchedule', () => {
  const baseDto = (days: PutScheduleDto['days']): PutScheduleDto => ({
    transponderNumber: 'TAG1',
    enabled: true,
    days,
  });

  it('putSchedule_withRangeEndBeforeStart_throwsBadRequest', async () => {
    const mock = makePrismaMock();
    const dto = baseDto([{ dayOfWeek: 1, allDay: false, ranges: [{ startMinute: 600, endMinute: 600 }] }]);
    await expect(service(mock).putSchedule(ACCOUNT, dto)).rejects.toBeInstanceOf(BadRequestException);
    expect(mock.$transaction).not.toHaveBeenCalled();
  });

  it('putSchedule_withDuplicateDayOfWeek_throwsBadRequest', async () => {
    const mock = makePrismaMock();
    const dto = baseDto([
      { dayOfWeek: 1, allDay: true, ranges: [] },
      { dayOfWeek: 1, allDay: true, ranges: [] },
    ]);
    await expect(service(mock).putSchedule(ACCOUNT, dto)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('putSchedule_withAllDay_persistsEmptyRanges', async () => {
    const mock = makePrismaMock();
    const dto = baseDto([{ dayOfWeek: 3, allDay: true, ranges: [{ startMinute: 0, endMinute: 60 }] }]);
    await service(mock).putSchedule(ACCOUNT, dto);
    expect(mock._tx.scheduleDay.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ dayOfWeek: 3, allDay: true, ranges: [] }) }),
    );
  });

  it('putSchedule_always_scopesUpsertByAccountId', async () => {
    const mock = makePrismaMock();
    await service(mock).putSchedule(ACCOUNT, baseDto([]));
    expect(mock._tx.weeklySchedule.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { accountId_transponderNumber: { accountId: ACCOUNT, transponderNumber: 'TAG1' } },
      }),
    );
  });
});

describe('ScheduleService.deleteSchedule', () => {
  it('deleteSchedule_always_scopesByAccountId', async () => {
    const mock = makePrismaMock();
    const result = await service(mock).deleteSchedule(ACCOUNT, 'TAG1');
    expect(result).toEqual({ deleted: true });
    expect(mock.weeklySchedule.deleteMany).toHaveBeenCalledWith({
      where: { accountId: ACCOUNT, transponderNumber: 'TAG1' },
    });
  });
});
