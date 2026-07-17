import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import { PutScheduleDto } from '../../models/schedule/PutScheduleDto';
import { parseRanges } from './schedule-window';

const DEFAULT_TIMEZONE = 'America/New_York';

export interface ScheduleTimeRange {
  startMinute: number;
  endMinute: number;
}

export interface ScheduleDayView {
  dayOfWeek: number;
  allDay: boolean;
  ranges: ScheduleTimeRange[];
}

export interface ScheduleView {
  transponderNumber: string;
  enabled: boolean;
  timezone: string;
  horizonDays: number;
  days: ScheduleDayView[];
  /** Whether the tenant has stored credentials for unattended scheduling. */
  credentialOnFile: boolean;
}

/**
 * Persists per-vehicle weekly schedules. Every row is scoped by accountId (the
 * NCQP account number, the tenant key) — the accountId always comes from the
 * authenticated session, never from client input. No NCQP calls happen here;
 * materialization into real declarations is a later concern.
 */
@Injectable()
export class ScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  async getSchedule(accountId: string, transponderNumber: string): Promise<ScheduleView> {
    const transponder = ScheduleService.requireTransponder(transponderNumber);
    const schedule = await this.prisma.weeklySchedule.findUnique({
      where: { accountId_transponderNumber: { accountId, transponderNumber: transponder } },
      include: { days: { orderBy: { dayOfWeek: 'asc' } } },
    });
    const credentialOnFile = (await this.prisma.credential.count({ where: { accountId } })) > 0;

    if (!schedule) {
      return {
        transponderNumber: transponder,
        enabled: false,
        timezone: DEFAULT_TIMEZONE,
        horizonDays: 7,
        days: [],
        credentialOnFile,
      };
    }

    return {
      transponderNumber: schedule.transponderNumber,
      enabled: schedule.enabled,
      timezone: schedule.timezone,
      horizonDays: schedule.horizonDays,
      days: schedule.days.map((d) => ({
        dayOfWeek: d.dayOfWeek,
        allDay: d.allDay,
        ranges: ScheduleService.asRanges(d.ranges),
      })),
      credentialOnFile,
    };
  }

  async putSchedule(accountId: string, dto: PutScheduleDto): Promise<ScheduleView> {
    const transponder = ScheduleService.requireTransponder(dto.transponderNumber);
    const timezone = dto.timezone || DEFAULT_TIMEZONE;
    const days = ScheduleService.validateDays(dto.days);

    await this.prisma.$transaction(async (tx) => {
      const schedule = await tx.weeklySchedule.upsert({
        where: { accountId_transponderNumber: { accountId, transponderNumber: transponder } },
        create: { accountId, transponderNumber: transponder, enabled: dto.enabled, timezone },
        update: { enabled: dto.enabled, timezone },
      });
      // Replace the day set wholesale — the schedule is small and always saved
      // as a unit, so a diff would only add complexity.
      await tx.scheduleDay.deleteMany({ where: { scheduleId: schedule.id } });
      for (const day of days) {
        await tx.scheduleDay.create({
          data: {
            scheduleId: schedule.id,
            dayOfWeek: day.dayOfWeek,
            allDay: day.allDay,
            ranges: (day.allDay ? [] : day.ranges) as unknown as Prisma.InputJsonValue,
          },
        });
      }
    });

    return this.getSchedule(accountId, transponder);
  }

  async deleteSchedule(
    accountId: string,
    transponderNumber: string,
  ): Promise<{ deleted: boolean }> {
    const transponder = ScheduleService.requireTransponder(transponderNumber);
    const result = await this.prisma.weeklySchedule.deleteMany({
      where: { accountId, transponderNumber: transponder },
    });
    return { deleted: result.count > 0 };
  }

  /** Whether the tenant has any schedule at all (drives vault teardown on delete). */
  async hasAnySchedule(accountId: string): Promise<boolean> {
    return (await this.prisma.weeklySchedule.count({ where: { accountId } })) > 0;
  }

  /** Find a schedule's id for a transponder, if it exists. */
  async findScheduleId(accountId: string, transponderNumber: string): Promise<string | null> {
    const row = await this.prisma.weeklySchedule.findUnique({
      where: { accountId_transponderNumber: { accountId, transponderNumber } },
      select: { id: true },
    });
    return row?.id ?? null;
  }

  private static requireTransponder(value: string | undefined): string {
    const transponder = (value ?? '').trim();
    if (!transponder) throw new BadRequestException('transponder is required');
    return transponder;
  }

  private static validateDays(days: PutScheduleDto['days']): ScheduleDayView[] {
    const seen = new Set<number>();
    return days.map((day) => {
      if (seen.has(day.dayOfWeek)) {
        throw new BadRequestException(`Duplicate dayOfWeek ${day.dayOfWeek}`);
      }
      seen.add(day.dayOfWeek);
      const ranges = day.allDay ? [] : day.ranges;
      for (const range of ranges) {
        if (range.endMinute <= range.startMinute) {
          throw new BadRequestException(
            `Range end (${range.endMinute}) must be after start (${range.startMinute})`,
          );
        }
      }
      return { dayOfWeek: day.dayOfWeek, allDay: day.allDay, ranges };
    });
  }

  private static asRanges(value: unknown): ScheduleTimeRange[] {
    return parseRanges(value);
  }
}
