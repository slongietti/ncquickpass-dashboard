import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import type { NcqpSession } from '../auth/session';
import { AccountService, AccountSummary } from './account.service';

@Controller('account')
@UseGuards(AuthGuard)
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get()
  summary(@CurrentSession() session: NcqpSession): Promise<AccountSummary> {
    return this.account.getSummary(session);
  }
}
