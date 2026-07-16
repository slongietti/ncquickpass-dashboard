import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/session/auth.guard';
import { CurrentSession } from '../auth/session/current-session.decorator';
import type { NcqpSession } from '../auth/session/session';
import { PutScheduleDto } from '../../models/schedule/PutScheduleDto';
import { ConflictCheckDto } from '../../models/schedule/ConflictCheckDto';
import { CancelMaterializedDto } from '../../models/schedule/CancelMaterializedDto';
import { ResolveConflictDto } from '../../models/schedule/ResolveConflictDto';
import { ScheduleService, ScheduleView } from './schedule.service';
import {
  FutureDeclarationView,
  MaterializationService,
  MaterializeContext,
} from './materialization.service';
import { CredentialVaultService } from './credential-vault.service';

@Controller('hov/schedule')
@UseGuards(AuthGuard)
export class ScheduleController {
  constructor(
    private readonly schedule: ScheduleService,
    private readonly materialization: MaterializationService,
    private readonly vault: CredentialVaultService,
  ) {}

  @Get()
  get(
    @CurrentSession() session: NcqpSession,
    @Query('transponder') transponder: string,
  ): Promise<ScheduleView> {
    return this.schedule.getSchedule(session.accountId, transponder);
  }

  @Put()
  async put(
    @CurrentSession() session: NcqpSession,
    @Body() dto: PutScheduleDto,
  ): Promise<ScheduleView> {
    await this.schedule.putSchedule(session.accountId, dto);

    if (dto.enabled) {
      if (!(await this.vault.has(session.accountId))) {
        if (!this.vault.enabled) {
          throw new BadRequestException('Automatic scheduling is not configured on this server.');
        }
        if (!dto.password) {
          throw new BadRequestException(
            'Enter your NC Quick Pass password to enable automatic scheduling.',
          );
        }
        await this.vault.store(session.accountId, session.username, dto.password);
      }
      // Materialize immediately using the in-request token.
      await this.materialization.reconcileAccount(ScheduleController.toContext(session));
    }

    return this.schedule.getSchedule(session.accountId, dto.transponderNumber);
  }

  @Delete()
  async remove(
    @CurrentSession() session: NcqpSession,
    @Query('transponder') transponder: string,
  ): Promise<{ deleted: boolean }> {
    await this.materialization.cancelForTransponder(
      ScheduleController.toContext(session),
      transponder,
    );
    const result = await this.schedule.deleteSchedule(session.accountId, transponder);
    if (!(await this.schedule.hasAnySchedule(session.accountId))) {
      await this.vault.remove(session.accountId);
    }
    return result;
  }

  @Get('future-declarations')
  future(@CurrentSession() session: NcqpSession): Promise<FutureDeclarationView[]> {
    return this.materialization.listFuture(session.accountId);
  }

  @Put('future-declarations/cancel')
  cancelFuture(
    @CurrentSession() session: NcqpSession,
    @Body() dto: CancelMaterializedDto,
  ): Promise<{ canceled: boolean }> {
    return this.materialization.cancelOne(ScheduleController.toContext(session), dto.id);
  }

  @Post('conflict-check')
  conflicts(
    @CurrentSession() session: NcqpSession,
    @Body() dto: ConflictCheckDto,
  ): Promise<FutureDeclarationView[]> {
    return this.materialization.findConflicts(
      session.accountId,
      dto.transponderNumber,
      new Date(dto.startDateTime),
      new Date(dto.endDateTime),
    );
  }

  @Post('resolve-conflict')
  resolve(
    @CurrentSession() session: NcqpSession,
    @Body() dto: ResolveConflictDto,
  ): Promise<{ canceled: number }> {
    return this.materialization.cancelMany(ScheduleController.toContext(session), dto.ids);
  }

  private static toContext(session: NcqpSession): MaterializeContext {
    return { token: session.token, userId: session.userId, accountId: session.accountId };
  }
}
