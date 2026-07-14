import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/session/auth.guard';
import { CurrentSession } from '../auth/session/current-session.decorator';
import type { NcqpSession } from '../auth/session/session';
import { TransactionView, TransactionsService } from './transactions.service';

@Controller('transactions')
@UseGuards(AuthGuard)
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  /** All transactions in the last `days` (default 90, capped at ~10 years). */
  @Get()
  search(
    @CurrentSession() session: NcqpSession,
    @Query('days', new DefaultValuePipe(90), ParseIntPipe) days: number,
  ): Promise<TransactionView[]> {
    const clamped = Math.min(Math.max(days, 1), 3650);
    return this.transactions.search(session, clamped);
  }
}
