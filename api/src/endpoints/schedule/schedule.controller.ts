import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Query,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthGuard } from '../auth/session/auth.guard';
import { AuthService } from '../auth/auth.service';
import { CurrentSession } from '../auth/session/current-session.decorator';
import type { NcqpSession } from '../auth/session/session';
import { writeSessionCookie } from '../auth/session/session-cookie';
import { PutScheduleDto } from '../../models/schedule/PutScheduleDto';
import { ConflictCheckDto } from '../../models/schedule/ConflictCheckDto';
import { CancelMaterializedDto } from '../../models/schedule/CancelMaterializedDto';
import { ResolveConflictDto } from '../../models/schedule/ResolveConflictDto';
import { AdhocDeclarationDto } from '../../models/schedule/AdhocDeclarationDto';
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
    private readonly auth: AuthService,
    private readonly config: ConfigService,
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
    @Res({ passthrough: true }) res: Response,
  ): Promise<ScheduleView> {
    let context = ScheduleController.toContext(session);

    // An enabled schedule runs in the background, so we (re)arm the vault with the
    // supplied password on EVERY save — the NCQP password may have changed since
    // last time. This also verifies the password and refreshes the browser token.
    if (dto.enabled) {
      context = await this.armVault(session, dto.password, res);
    }

    await this.schedule.putSchedule(session.accountId, dto);

    if (dto.enabled) {
      // Materialize immediately using the freshly-minted token.
      await this.materialization.reconcileAccount(context);
    }

    return this.schedule.getSchedule(session.accountId, dto.transponderNumber);
  }

  /**
   * Create a one-off ad-hoc future-dated declaration directly with the caller's
   * session token. It never runs in the background (the cron only reconciles
   * weekly schedules), so it needs no password and no vault. It is still stored
   * as a `source: 'adhoc'` row so it appears in Upcoming and is conflict-checked.
   */
  @Post('adhoc')
  async adhoc(
    @CurrentSession() session: NcqpSession,
    @Body() dto: AdhocDeclarationDto,
  ): Promise<FutureDeclarationView> {
    const start = new Date(dto.startDateTime);
    const end = new Date(dto.endDateTime);
    if (!(end.getTime() > start.getTime())) {
      throw new BadRequestException('The end time must be after the start time.');
    }
    return this.materialization.createAdhoc(
      ScheduleController.toContext(session),
      dto.transponderNumber,
      start,
      end,
    );
  }

  /**
   * Verify the NCQP password mints a token, (re)store it in the vault, refresh the
   * browser's session cookie with the fresh token, and return a materialization
   * context that uses it. Throws if scheduling is unconfigured or the password is
   * missing/incorrect.
   */
  private async armVault(
    session: NcqpSession,
    password: string | undefined,
    res: Response,
  ): Promise<MaterializeContext> {
    if (!this.vault.enabled) {
      throw new BadRequestException('Automatic scheduling is not configured on this server.');
    }
    if (!password) {
      throw new BadRequestException(
        'Enter your NC Quick Pass password to enable automatic scheduling.',
      );
    }
    let verified: NcqpSession;
    try {
      verified = await this.auth.login(session.username, password);
    } catch {
      throw new UnauthorizedException(
        'That NC Quick Pass password was incorrect. Please re-enter your password.',
      );
    }
    await this.vault.store(session.accountId, session.username, password);
    const secure = this.config.get<string>('COOKIE_SECURE', 'false') === 'true';
    writeSessionCookie(res, verified, secure);
    return ScheduleController.toContext(verified);
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
