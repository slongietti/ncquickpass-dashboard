import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import type { NcqpSession } from '../auth/session';
import { ActivateDto } from './dto/activate.dto';
import { CancelDto } from './dto/cancel.dto';
import { DeclarationView, HovService, VehicleView } from './hov.service';

@Controller('hov')
@UseGuards(AuthGuard)
export class HovController {
  constructor(private readonly hov: HovService) {}

  @Get('vehicles')
  vehicles(@CurrentSession() session: NcqpSession): Promise<VehicleView[]> {
    return this.hov.getVehicles(session);
  }

  @Get('status')
  status(@CurrentSession() session: NcqpSession): Promise<DeclarationView[]> {
    return this.hov.getStatus(session);
  }

  @Post('activate')
  activate(
    @CurrentSession() session: NcqpSession,
    @Body() dto: ActivateDto,
  ): Promise<{ declarationId: number }> {
    return this.hov.activate(session, dto);
  }

  @Put('cancel')
  cancel(
    @CurrentSession() session: NcqpSession,
    @Body() dto: CancelDto,
  ): Promise<{ result: string }> {
    return this.hov.cancel(session, dto.declarationId);
  }
}
