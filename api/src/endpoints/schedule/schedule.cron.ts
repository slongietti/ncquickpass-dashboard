import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { NcqpService } from '../ncqp/ncqp.service';
import { AuthService } from '../auth/auth.service';
import { CredentialVaultService } from './credential-vault.service';
import { MaterializationService } from './materialization.service';

/**
 * Keeps the rolling declaration horizon full without a user present. Daily, for
 * each tenant with stored credentials, it decrypts them, re-authenticates with
 * NCQP for a fresh short-lived token, and reconciles that tenant's schedules.
 * Runs often enough to top up a ~7-day horizon and absorb any NCQP near-term
 * future-dating limit.
 */
@Injectable()
export class ScheduleCron {
  private readonly logger = new Logger(ScheduleCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ncqp: NcqpService,
    private readonly vault: CredentialVaultService,
    private readonly materialization: MaterializationService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async reconcileAll(): Promise<void> {
    if (!this.vault.enabled) return;
    const tenants = await this.prisma.credential.findMany({ select: { accountId: true } });
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
  }
}
