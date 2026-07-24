import { Injectable, Logger } from '@nestjs/common';
import { DateTime } from 'luxon';
import { NcqpAccountClient } from '../ncqp/ncqp-account.client';
import { NcqpHovClient } from '../ncqp/ncqp-hov.client';
import { RoadGroupService } from '../../roads/road-group.service';
import { DbClient } from '../../database/db-client';
import { DeclarationSource, DeclarationStatus } from '../schedule/schedule.constants';
import { NcqpDeclaration } from '../../models/ncqp/NcqpDeclaration';
import { NcqpVehicleTag } from '../../models/ncqp/NcqpVehicleTag';
import { NcqpSession } from '../auth/session/session';
import { ActivateDto } from '../../models/hov/ActivateDto';

/** NC is Eastern; a "rest of today" declaration ends at local end-of-day. */
const HOV_TIMEZONE = 'America/New_York';

export interface VehicleView {
  transponderNumber: string;
  friendlyName: string;
  status: string;
  description: string;
}

export interface DeclarationView {
  declarationId: string;
  transponderNumber: string;
  nickName: string;
  location: string;
  status: string;
  option: string;
  startDateTime: string | null;
  endDateTime: string | null;
}

@Injectable()
export class HovService {
  private readonly logger = new Logger(HovService.name);

  constructor(
    private readonly accountClient: NcqpAccountClient,
    private readonly hovClient: NcqpHovClient,
    private readonly db: DbClient,
    private readonly roads: RoadGroupService,
  ) {}

  async getVehicles(session: NcqpSession): Promise<VehicleView[]> {
    const raw = await this.accountClient.getVehicles(session.token);
    const seen = new Set<string>();
    const out: VehicleView[] = [];
    for (const v of raw) {
      const transponderNumber = HovService.transponderOf(v);
      if (!transponderNumber || seen.has(transponderNumber)) continue;
      seen.add(transponderNumber);
      out.push({
        transponderNumber,
        friendlyName: v.tagFriendlyName || v.tagTypeCache?.friendlyName || '',
        status: v.vehicleTagStatus || v.tagTypeCache?.tagStatus || 'UNKNOWN',
        description: [v.vehicleYear, v.vehicleMakeName, v.vehicleModelName]
          .filter(Boolean)
          .join(' '),
      });
    }
    return out;
  }

  async getStatus(session: NcqpSession): Promise<DeclarationView[]> {
    const raw = await this.hovClient.getHovDeclarations(session.token, session.accountId);
    return raw.map((d) => HovService.toDeclarationView(d));
  }

  async activate(
    session: NcqpSession,
    dto: ActivateDto,
  ): Promise<{ declarationId: number }> {
    const start = new Date();
    const useCustom = !!dto.endDateTime;
    const end = useCustom
      ? new Date(dto.endDateTime as string)
      : DateTime.fromJSDate(start, { zone: HOV_TIMEZONE }).endOf('day').toUTC().toJSDate();
    const declarationId = await this.hovClient.activateHov(session.token, {
      accountId: session.accountId,
      transponderNumber: dto.transponderNumber,
      location: dto.location || this.roads.defaultHovLocation(),
      startDateTime: start.toISOString(),
      endDateTime: useCustom ? end.toISOString() : null,
      createdByUserId: session.userId,
      option: useCustom ? 'DateInTheFuture' : 'RestOfToday',
    });
    await this.record(session, dto.transponderNumber, start, end, declarationId);
    return { declarationId };
  }

  async cancel(session: NcqpSession, declarationId: string): Promise<{ result: string }> {
    const result = await this.hovClient.cancelHov(session.token, declarationId, session.userId);
    // Best-effort ledger sync; the cancel at NCQP already succeeded.
    try {
      await this.db.hOVDeclaration.updateMany({
        where: {
          accountId: session.accountId,
          ncqpDeclarationId: declarationId,
          status: DeclarationStatus.Materialized,
        },
        data: { status: DeclarationStatus.Canceled },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to sync canceled declaration ${declarationId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
    return { result };
  }

  /**
   * Record an immediate "activate now" declaration so every declaration the user
   * creates lands in the ledger, not only future-dated ones. Best-effort: the
   * NCQP declaration already exists, so a DB hiccup must not fail the request.
   */
  private async record(
    session: NcqpSession,
    transponderNumber: string,
    windowStart: Date,
    windowEnd: Date,
    declarationId: number,
  ): Promise<void> {
    try {
      await this.db.hOVDeclaration.upsert({
        where: {
          accountId_transponderNumber_windowStart_windowEnd: {
            accountId: session.accountId,
            transponderNumber,
            windowStart,
            windowEnd,
          },
        },
        create: {
          accountId: session.accountId,
          scheduleId: null,
          source: DeclarationSource.Adhoc,
          transponderNumber,
          windowStart,
          windowEnd,
          ncqpDeclarationId: String(declarationId),
          status: DeclarationStatus.Materialized,
        },
        update: {
          source: DeclarationSource.Adhoc,
          ncqpDeclarationId: String(declarationId),
          status: DeclarationStatus.Materialized,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to record declaration for ${transponderNumber}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private static transponderOf(v: NcqpVehicleTag): string {
    return (
      v.tagTypeCache?.tag?.tagNumberValue ||
      v.tagTypeCache?.tagNumber ||
      v.vehicleTagNumber ||
      ''
    );
  }

  private static toDeclarationView(d: NcqpDeclaration): DeclarationView {
    return {
      declarationId: String(d.declarationId ?? ''),
      transponderNumber: d.transponderNumber ?? '',
      nickName: d.nickName ?? '',
      location: d.location ?? '',
      status: d.status ?? '',
      option: d.option ?? '',
      startDateTime: d.startDateTime ?? null,
      endDateTime: d.endDateTime ?? null,
    };
  }
}
