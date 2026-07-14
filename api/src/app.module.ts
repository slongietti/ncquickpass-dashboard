import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NcqpModule } from './ncqp/ncqp.module';
import { AuthModule } from './auth/auth.module';
import { AccountModule } from './account/account.module';
import { HovModule } from './hov/hov.module';
import { TransactionsModule } from './transactions/transactions.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    NcqpModule,
    AuthModule,
    AccountModule,
    HovModule,
    TransactionsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
