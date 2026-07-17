import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { NcqpModule } from './endpoints/ncqp/ncqp.module';
import { AuthModule } from './endpoints/auth/auth.module';
import { AccountModule } from './endpoints/account/account.module';
import { HovModule } from './endpoints/hov/hov.module';
import { HovScheduleModule } from './endpoints/schedule/schedule.module';
import { TransactionsModule } from './endpoints/transactions/transactions.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    NcqpModule,
    AuthModule,
    AccountModule,
    HovModule,
    HovScheduleModule,
    TransactionsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
