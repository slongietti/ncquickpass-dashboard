import { Body, Controller, HttpCode, Logger, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReconcileAllResult, ScheduleCron } from './schedule.cron';

/**
 * HTTP trigger for the background reconcile, used on Lambda where the in-process
 * cron can't run. EventBridge Scheduler invokes the function daily; the AWS
 * Lambda Web Adapter routes that non-HTTP event to this path (its pass-through
 * path is set to /api/internal/cron). The Function URL is public, so the request
 * must carry the shared CRON_SECRET (placed in the schedule's input payload).
 * With no CRON_SECRET configured the endpoint refuses — no unauthenticated runs.
 */
@Controller('internal/cron')
export class CronController {
  private readonly logger = new Logger(CronController.name);

  constructor(
    private readonly cron: ScheduleCron,
    private readonly config: ConfigService,
  ) {}

  @Post()
  @HttpCode(200)
  async trigger(@Body() body: { secret?: string }): Promise<{ ok: true } & ReconcileAllResult> {
    const expected = this.config.get<string>('CRON_SECRET');
    if (!expected || body?.secret !== expected) {
      throw new UnauthorizedException();
    }
    const summary = await this.cron.reconcileAll();
    this.logger.log(
      `Cron reconcile: ${summary.tenants} tenant(s), +${summary.created} / -${summary.canceled}`,
    );
    return { ok: true, ...summary };
  }
}
