import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NcqpService } from '../ncqp/ncqp.service';
import { computeWindows, parseRanges, WindowDay } from './schedule-window';
import { overlaps } from './conflict';

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
  ncqpDeclarationId: string | null;
}

export interface ReconcileResult {
  created: number;
  canceled: number;
}

const HOV_LOCATION = 'I-77';

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
    private readonly prisma: PrismaService,
    private readonly ncqp: NcqpService,
  ) {}

  /** Reconcile every enabled schedule for the tenant. */
  async reconcileAccount(ctx: MaterializeContext): Promise<ReconcileResult> {
    const schedules = await this.prisma.weeklySchedule.findMany({
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
    const schedule = await this.prisma.weeklySchedule.findFirst({
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
    const existing = await this.prisma.hOVDeclaration.findMany({
      where: {
        accountId: ctx.accountId,
        transponderNumber: schedule.transponderNumber,
        status: 'materialized',
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
          location: HOV_LOCATION,
          startDateTime: window.start.toISOString(),
          endDateTime: window.end.toISOString(),
          createdByUserId: ctx.userId,
          option: 'DateInTheFuture',
        });
        await this.prisma.hOVDeclaration.upsert({
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
            transponderNumber: schedule.transponderNumber,
            windowStart: window.start,
            windowEnd: window.end,
            ncqpDeclarationId: String(declarationId),
            status: 'materialized',
          },
          update: { ncqpDeclarationId: String(declarationId), status: 'materialized' },
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
      canceled += (await this.cancelRow(ctx, row.id, row.ncqpDeclarationId, 'canceled')) ? 1 : 0;
    }

    return { created, canceled };
  }

  async listFuture(accountId: string): Promise<FutureDeclarationView[]> {
    const rows = await this.prisma.hOVDeclaration.findMany({
      where: { accountId, status: 'materialized', windowEnd: { gte: new Date() } },
      orderBy: { windowStart: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      transponderNumber: r.transponderNumber,
      windowStart: r.windowStart.toISOString(),
      windowEnd: r.windowEnd.toISOString(),
      status: r.status,
      ncqpDeclarationId: r.ncqpDeclarationId,
    }));
  }

  /** Future materialized declarations for a transponder that overlap an ad-hoc window. */
  async findConflicts(
    accountId: string,
    transponderNumber: string,
    start: Date,
    end: Date,
  ): Promise<FutureDeclarationView[]> {
    const rows = await this.prisma.hOVDeclaration.findMany({
      where: {
        accountId,
        transponderNumber,
        status: 'materialized',
        windowEnd: { gte: new Date() },
      },
    });
    return rows
      .filter((r) => overlaps({ start, end }, { start: r.windowStart, end: r.windowEnd }))
      .map((r) => ({
        id: r.id,
        transponderNumber: r.transponderNumber,
        windowStart: r.windowStart.toISOString(),
        windowEnd: r.windowEnd.toISOString(),
        status: r.status,
        ncqpDeclarationId: r.ncqpDeclarationId,
      }));
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
    const row = await this.prisma.hOVDeclaration.findFirst({
      where: { id, accountId: ctx.accountId },
    });
    if (!row) throw new NotFoundException('Declaration not found');
    const ok = await this.cancelRow(ctx, row.id, row.ncqpDeclarationId, 'canceled');
    return { canceled: ok };
  }

  /** Cancel all materialized future declarations for a transponder (schedule removed). */
  async cancelForTransponder(ctx: MaterializeContext, transponderNumber: string): Promise<number> {
    const rows = await this.prisma.hOVDeclaration.findMany({
      where: {
        accountId: ctx.accountId,
        transponderNumber,
        status: 'materialized',
        windowEnd: { gte: new Date() },
      },
    });
    let canceled = 0;
    for (const row of rows) {
      canceled += (await this.cancelRow(ctx, row.id, row.ncqpDeclarationId, 'canceled')) ? 1 : 0;
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
      await this.prisma.hOVDeclaration.update({ where: { id }, data: { status } });
      return true;
    } catch (err) {
      this.logger.warn(
        `Cancel failed for declaration ${id}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }
}
