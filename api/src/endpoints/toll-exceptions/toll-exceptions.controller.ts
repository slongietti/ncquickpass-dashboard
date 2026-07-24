import { Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../auth/session/auth.guard';
import { CurrentSession } from '../auth/session/current-session.decorator';
import type { NcqpSession } from '../auth/session/session';
import { CreateDisputeDto } from '../../models/tollExceptions/CreateDisputeDto';
import { Dispute } from './dispute-correspondence';
import {
  CreateDisputeResult,
  DisputeReasonView,
  TollExceptionsService,
} from './toll-exceptions.service';

@Controller('toll-exceptions')
@UseGuards(AuthGuard)
export class TollExceptionsController {
  constructor(private readonly service: TollExceptionsService) {}

  @Get('disputes')
  disputes(@CurrentSession() session: NcqpSession): Promise<Dispute[]> {
    return this.service.getDisputes(session);
  }

  @Get('reasons')
  reasons(@CurrentSession() session: NcqpSession): Promise<DisputeReasonView[]> {
    return this.service.getReasons(session);
  }

  @Post('disputes')
  create(
    @CurrentSession() session: NcqpSession,
    @Body() dto: CreateDisputeDto,
  ): Promise<CreateDisputeResult> {
    return this.service.createDispute(session, dto);
  }

  /** Stream a correspondence document (the attached vehicle image) for inline display. */
  @Get('documents/:id')
  async document(
    @CurrentSession() session: NcqpSession,
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const doc = await this.service.getDocument(session, id);
    res.setHeader('Content-Type', doc.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${doc.filename}"`);
    res.send(doc.data);
  }
}
