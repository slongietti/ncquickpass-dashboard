import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { NcqpService } from '../ncqp/ncqp.service';
import { AuthService } from '../auth/auth.service';
import { CredentialVaultService } from './credential-vault.service';
import { MaterializationService } from './materialization.service';

/** Totals across every tenant reconciled in one run. */
export interface ReconcileAllResult {
  tenants: number;
  created: number;
  canceled: number;
}

/**
 * Keeps the rolling declaration horizon full without a user present: for each
 * tenant with stored credentials, decrypt them, re-authenticate with NCQP for a
 * fresh short-lived token, and reconcile that tenant's schedules.
 *
 * There are two ways this fires. Where the process is always on (local dev,
 * docker-compose) the in-process `@Cron` triggers it daily. On Lambda the
 * process is frozen between invocations, so in-process timers can't be trusted;
 * there EventBridge Scheduler invokes the function daily and the Web Adapter
 * routes it to CronController, which calls `reconcileAll()`. The in-process cron
 * is therefore disabled under Lambda to avoid nothing/double runs.
 */
@Injectable()
export class ScheduleCron {
  private readonly logger = new Logger(ScheduleCron.name);
  /** In-process cron only where the process stays alive; never under Lambda. */
  private readonly inProcessEnabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ncqp: NcqpService,
    private readonly vault: CredentialVaultService,
    private readonly materialization: MaterializationService,
    config: ConfigService,
  ) {
    // Lambda sets AWS_LAMBDA_FUNCTION_NAME; there the process is frozen between
    // invocations, so EventBridge drives the reconcile instead of this timer.
    this.inProcessEnabled = !config.get<string>('AWS_LAMBDA_FUNCTION_NAME');
  }

  /** In-process daily trigger (skipped under Lambda — EventBridge drives it there). */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async scheduledReconcile(): Promise<void> {
    if (!this.inProcessEnabled) return;
    await this.reconcileAll();
  }

  /** Reconcile every tenant's schedules. Called by the in-process cron and by
   *  CronController (EventBridge). Per-tenant failures are logged, not thrown. */
  async reconcileAll(): Promise<ReconcileAllResult> {
    const totals: ReconcileAllResult = { tenants: 0, created: 0, canceled: 0 };
    if (!this.vault.enabled) return totals;
    const tenants = await this.prisma.credential.findMany({ select: { accountId: true } });
    totals.tenants = tenants.length;
    this.logger.log(`Reconciling schedules for ${tenants.length} tenant(s)`);

    for (const { accountId } of tenants) {
      try {
        const creds = await this.vault.load(accountId);
        if (!creds) continue;
        const token = await this.ncqp.login(creds.username, creds.password);
        const info = AuthService.parseUserInfo(token.UserInfo);
        const userId =
          info.WebUserId != null ? String(info.WebUserId) : String(info.UserID ?? '');
        if (!userId) {
          this.logger.warn(`No user id resolved for tenant ${accountId}; skipping`);
          continue;
        }
        const result = await this.materialization.reconcileAccount({
          token: token.access_token,
          userId,
          accountId,
        });
        totals.created += result.created;
        totals.canceled += result.canceled;
        if (result.created || result.canceled) {
          this.logger.log(
            `Tenant ${accountId}: +${result.created} / -${result.canceled} declarations`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `Reconcile failed for tenant ${accountId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
    return totals;
  }
}
