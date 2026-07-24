import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DbClient } from '../../database/db-client';
import { NcqpHovClient } from '../ncqp/ncqp-hov.client';
import { RoadGroupService } from '../../roads/road-group.service';
import { computeWindows, parseRanges, WindowDay } from './schedule-window';
import { overlaps } from './conflict';
import { DeclarationSource, DeclarationStatus } from './schedule.constants';

/** Credentials + identifiers needed to act on NCQP for one tenant. */
export interface MaterializeContext {
  token: string;
  userId: string;
  accountId: string;
}

export interface FutureDeclarationView {
  id: string;
  transponderNumber: string;
  windowStart: string;
  windowEnd: string;
  status: string;
  /** How this declaration was derived: 'weekly' schedule or 'adhoc'. */
  source: string;
  ncqpDeclarationId: string | null;
}

/** Shape of an HOVDeclaration row as returned by Prisma (only fields we map). */
interface DeclarationRow {
  id: string;
  transponderNumber: string;
  windowStart: Date;
  windowEnd: Date;
  status: string;
  source: string;
  ncqpDeclarationId: string | null;
}

export interface ReconcileResult {
  created: number;
  canceled: number;
}

/**
 * Reconciles a saved weekly schedule with real NCQP declarations: creates
 * future-dated declarations for windows that should exist and cancels ones the
 * schedule no longer covers. Idempotent — the (account, transponder, window)
 * unique key means re-running never duplicates. Takes an explicit context so
 * both the request path and the background cron can call it.
 */
@Injectable()
export class MaterializationService {
  private readonly logger = new Logger(MaterializationService.name);

  constructor(
    private readonly db: DbClient,
    private readonly ncqp: NcqpHovClient,
    private readonly roads: RoadGroupService,
  ) {}

  /** Reconcile every enabled schedule for the tenant. */
  async reconcileAccount(ctx: MaterializeContext): Promise<ReconcileResult> {
    const schedules = await this.db.weeklySchedule.findMany({
      where: { accountId: ctx.accountId, enabled: true },
      include: { days: true },
    });
    const total: ReconcileResult = { created: 0, canceled: 0 };
    for (const schedule of schedules) {
      const result = await this.reconcileSchedule(ctx, schedule.id);
      total.created += result.created;
      total.canceled += result.canceled;
    }
    return total;
  }

  async reconcileSchedule(ctx: MaterializeContext, scheduleId: string): Promise<ReconcileResult> {
    const schedule = await this.db.weeklySchedule.findFirst({
      where: { id: scheduleId, accountId: ctx.accountId },
      include: { days: true },
    });
    if (!schedule || !schedule.enabled) return { created: 0, canceled: 0 };

    const days: WindowDay[] = schedule.days.map((d) => ({
      dayOfWeek: d.dayOfWeek,
      allDay: d.allDay,
      ranges: parseRanges(d.ranges),
    }));
    const desired = computeWindows(
      { days, timezone: schedule.timezone, horizonDays: schedule.horizonDays },
      new Date(),
    );
    // Only this schedule's own (weekly) rows — never diff or cancel ad-hoc ones.
    const existing = await this.db.hOVDeclaration.findMany({
      where: {
        accountId: ctx.accountId,
        transponderNumber: schedule.transponderNumber,
        scheduleId: schedule.id,
        status: DeclarationStatus.Materialized,
        windowEnd: { gte: new Date() },
      },
    });

    const keyOf = (start: Date, end: Date): string => `${start.getTime()}_${end.getTime()}`;
    const desiredMap = new Map(desired.map((w) => [keyOf(w.start, w.end), w]));
    const existingKeys = new Set(existing.map((e) => keyOf(e.windowStart, e.windowEnd)));

    let created = 0;
    for (const [key, window] of desiredMap) {
      if (existingKeys.has(key)) continue;
      try {
        const declarationId = await this.ncqp.activateHov(ctx.token, {
          accountId: ctx.accountId,
          transponderNumber: schedule.transponderNumber,
          location: this.roads.defaultHovLocation(),
          startDateTime: window.start.toISOString(),
          endDateTime: window.end.toISOString(),
          createdByUserId: ctx.userId,
          option: 'DateInTheFuture',
        });
        await this.db.hOVDeclaration.upsert({
          where: {
            accountId_transponderNumber_windowStart_windowEnd: {
              accountId: ctx.accountId,
              transponderNumber: schedule.transponderNumber,
              windowStart: window.start,
              windowEnd: window.end,
            },
          },
          create: {
            accountId: ctx.accountId,
            scheduleId: schedule.id,
            source: DeclarationSource.Weekly,
            transponderNumber: schedule.transponderNumber,
            windowStart: window.start,
            windowEnd: window.end,
            ncqpDeclarationId: String(declarationId),
            status: DeclarationStatus.Materialized,
          },
          update: {
            scheduleId: schedule.id,
            source: DeclarationSource.Weekly,
            ncqpDeclarationId: String(declarationId),
            status: DeclarationStatus.Materialized,
          },
        });
        created++;
      } catch (err) {
        this.logger.warn(
          `Materialize failed for ${schedule.transponderNumber} @ ${window.start.toISOString()}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    let canceled = 0;
    for (const row of existing) {
      if (desiredMap.has(keyOf(row.windowStart, row.windowEnd))) continue;
      canceled += (await this.cancelRow(ctx, row.id, row.ncqpDeclarationId, DeclarationStatus.Canceled)) ? 1 : 0;
    }

    return { created, canceled };
  }

  async listFuture(accountId: string): Promise<FutureDeclarationView[]> {
    const rows = await this.db.hOVDeclaration.findMany({
      where: { accountId, status: DeclarationStatus.Materialized, windowEnd: { gte: new Date() } },
      orderBy: { windowStart: 'asc' },
    });
    return rows.map(MaterializationService.toView);
  }

  /**
   * Create a one-off ad-hoc future-dated declaration and persist it (source
   * 'adhoc', no schedule) so it shows in Upcoming and survives independently of
   * any weekly schedule. Uses the caller's token (freshly minted when arming the
   * vault) to create the NCQP declaration immediately.
   */
  async createAdhoc(
    ctx: MaterializeContext,
    transponderNumber: string,
    start: Date,
    end: Date,
  ): Promise<FutureDeclarationView> {
    const declarationId = await this.ncqp.activateHov(ctx.token, {
      accountId: ctx.accountId,
      transponderNumber,
      location: this.roads.defaultHovLocation(),
      startDateTime: start.toISOString(),
      endDateTime: end.toISOString(),
      createdByUserId: ctx.userId,
      option: 'DateInTheFuture',
    });
    const row = await this.db.hOVDeclaration.upsert({
      where: {
        accountId_transponderNumber_windowStart_windowEnd: {
          accountId: ctx.accountId,
          transponderNumber,
          windowStart: start,
          windowEnd: end,
        },
      },
      create: {
        accountId: ctx.accountId,
        scheduleId: null,
        source: DeclarationSource.Adhoc,
        transponderNumber,
        windowStart: start,
        windowEnd: end,
        ncqpDeclarationId: String(declarationId),
        status: DeclarationStatus.Materialized,
      },
      update: {
        source: DeclarationSource.Adhoc,
        ncqpDeclarationId: String(declarationId),
        status: DeclarationStatus.Materialized,
      },
    });
    return MaterializationService.toView(row);
  }

  /** Future materialized declarations for a transponder that overlap an ad-hoc window. */
  async findConflicts(
    accountId: string,
    transponderNumber: string,
    start: Date,
    end: Date,
  ): Promise<FutureDeclarationView[]> {
    const rows = await this.db.hOVDeclaration.findMany({
      where: {
        accountId,
        transponderNumber,
        status: DeclarationStatus.Materialized,
        windowEnd: { gte: new Date() },
      },
    });
    return rows
      .filter((r) => overlaps({ start, end }, { start: r.windowStart, end: r.windowEnd }))
      .map(MaterializationService.toView);
  }

  private static toView(r: DeclarationRow): FutureDeclarationView {
    return {
      id: r.id,
      transponderNumber: r.transponderNumber,
      windowStart: r.windowStart.toISOString(),
      windowEnd: r.windowEnd.toISOString(),
      status: r.status,
      source: r.source,
      ncqpDeclarationId: r.ncqpDeclarationId,
    };
  }

  /** Cancel several materialized declarations by id (e.g. resolving a conflict). */
  async cancelMany(ctx: MaterializeContext, ids: string[]): Promise<{ canceled: number }> {
    let canceled = 0;
    for (const id of ids) {
      try {
        if ((await this.cancelOne(ctx, id)).canceled) canceled++;
      } catch (err) {
        this.logger.warn(
          `Cancel (batch) failed for ${id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return { canceled };
  }

  /** Cancel one materialized declaration, verifying tenant ownership. */
  async cancelOne(ctx: MaterializeContext, id: string): Promise<{ canceled: boolean }> {
    if (!id) throw new BadRequestException('id is required');
    const row = await this.db.hOVDeclaration.findFirst({
      where: { id, accountId: ctx.accountId },
    });
    if (!row) throw new NotFoundException('Declaration not found');
    const ok = await this.cancelRow(ctx, row.id, row.ncqpDeclarationId, DeclarationStatus.Canceled);
    return { canceled: ok };
  }

  /**
   * Cancel a transponder's future WEEKLY declarations (its schedule was removed).
   * Ad-hoc declarations are independent and left untouched.
   */
  async cancelForTransponder(ctx: MaterializeContext, transponderNumber: string): Promise<number> {
    const rows = await this.db.hOVDeclaration.findMany({
      where: {
        accountId: ctx.accountId,
        transponderNumber,
        source: DeclarationSource.Weekly,
        status: DeclarationStatus.Materialized,
        windowEnd: { gte: new Date() },
      },
    });
    let canceled = 0;
    for (const row of rows) {
      canceled += (await this.cancelRow(ctx, row.id, row.ncqpDeclarationId, DeclarationStatus.Canceled)) ? 1 : 0;
    }
    return canceled;
  }

  private async cancelRow(
    ctx: MaterializeContext,
    id: string,
    ncqpDeclarationId: string | null,
    status: string,
  ): Promise<boolean> {
    try {
      if (ncqpDeclarationId) await this.ncqp.cancelHov(ctx.token, ncqpDeclarationId, ctx.userId);
      await this.db.hOVDeclaration.update({ where: { id }, data: { status } });
      return true;
    } catch (err) {
      this.logger.warn(
        `Cancel failed for declaration ${id}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }
}
