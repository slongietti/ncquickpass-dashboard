import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { CronController } from '../../../src/endpoints/schedule/cron.controller';
import { ScheduleCron } from '../../../src/endpoints/schedule/schedule.cron';

/** ScheduleCron double capturing whether the reconcile ran. */
function makeCronMock() {
  return {
    reconcileAll: jest.fn().mockResolvedValue({ tenants: 2, created: 3, canceled: 1 }),
  };
}

function controller(cronSecret: string | undefined, cron: ReturnType<typeof makeCronMock>) {
  const config = { get: jest.fn().mockReturnValue(cronSecret) } as unknown as ConfigService;
  return new CronController(cron as unknown as ScheduleCron, config);
}

describe('CronController.trigger', () => {
  it('trigger_withMatchingSecret_runsReconcileAndReturnsSummary', async () => {
    const cron = makeCronMock();
    const result = await controller('s3cret', cron).trigger({ secret: 's3cret' });
    expect(cron.reconcileAll).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true, tenants: 2, created: 3, canceled: 1 });
  });

  it('trigger_withWrongSecret_throwsUnauthorizedAndDoesNotReconcile', async () => {
    const cron = makeCronMock();
    await expect(controller('s3cret', cron).trigger({ secret: 'nope' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(cron.reconcileAll).not.toHaveBeenCalled();
  });

  it('trigger_whenNoSecretConfigured_throwsUnauthorized', async () => {
    const cron = makeCronMock();
    await expect(controller(undefined, cron).trigger({ secret: 'anything' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(cron.reconcileAll).not.toHaveBeenCalled();
  });
});
