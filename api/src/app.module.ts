import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NcqpModule } from './endpoints/ncqp/ncqp.module';
import { AuthModule } from './endpoints/auth/auth.module';
import { AccountModule } from './endpoints/account/account.module';
import { HovModule } from './endpoints/hov/hov.module';
import { TransactionsModule } from './endpoints/transactions/transactions.module';
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
