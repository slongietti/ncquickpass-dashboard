import { Injectable } from '@nestjs/common';
import { NcqpService } from '../ncqp/ncqp.service';
import { NcqpDeclaration, NcqpVehicleTag } from '../../models/ncqp/ncqp.types';
import { NcqpSession } from '../auth/session/session';
import { ActivateDto } from '../../models/hov/activate.dto';

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
  constructor(private readonly ncqp: NcqpService) {}

  async getVehicles(session: NcqpSession): Promise<VehicleView[]> {
    const raw = await this.ncqp.getVehicles(session.token);
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
    const raw = await this.ncqp.getHovDeclarations(session.token, session.accountId);
    return raw.map((d) => HovService.toDeclarationView(d));
  }

  async activate(
    session: NcqpSession,
    dto: ActivateDto,
  ): Promise<{ declarationId: number }> {
    const now = new Date().toISOString();
    const useCustom = !!dto.endDateTime;
    const declarationId = await this.ncqp.activateHov(session.token, {
      accountId: session.accountId,
      transponderNumber: dto.transponderNumber,
      location: dto.location || 'I-77',
      startDateTime: now,
      endDateTime: useCustom ? new Date(dto.endDateTime as string).toISOString() : null,
      createdByUserId: session.userId,
      option: useCustom ? 'DateInTheFuture' : 'RestOfToday',
    });
    return { declarationId };
  }

  async cancel(session: NcqpSession, declarationId: string): Promise<{ result: string }> {
    const result = await this.ncqp.cancelHov(session.token, declarationId, session.userId);
    return { result };
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
