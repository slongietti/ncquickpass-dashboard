import { Module } from '@nestjs/common';
import { NcqpAccountClient } from './ncqp-account.client';
import { NcqpCasesClient } from './ncqp-cases.client';
import { NcqpHovClient } from './ncqp-hov.client';
import { NcqpTransactionsClient } from './ncqp-transactions.client';

const clients = [NcqpAccountClient, NcqpTransactionsClient, NcqpHovClient, NcqpCasesClient];

@Module({
  providers: clients,
  exports: clients,
})
export class NcqpModule {}
