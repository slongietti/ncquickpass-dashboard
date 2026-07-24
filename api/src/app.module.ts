import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { DatabaseModule } from './database/database.module';
import { NcqpModule } from './endpoints/ncqp/ncqp.module';
import { AuthModule } from './endpoints/auth/auth.module';
import { AccountModule } from './endpoints/account/account.module';
import { HovModule } from './endpoints/hov/hov.module';
import { HovScheduleModule } from './endpoints/schedule/schedule.module';
import { TransactionsModule } from './endpoints/transactions/transactions.module';
import { TollExceptionsModule } from './endpoints/toll-exceptions/toll-exceptions.module';
import { RoadGroupModule } from './roads/road-group.module';
import { HealthController } from './health.controller';

// In the deployed (Lambda) container the Angular build is copied to ../client and
// Nest serves it same-origin with the API; /api/* is excluded so it stays the API
// and everything else falls back to the SPA's index.html. The directory is absent
// in local dev (the SPA runs on `ng serve`), so serving is skipped there.
const clientPath = join(__dirname, '..', 'client');
const serveStatic = existsSync(clientPath)
  ? [ServeStaticModule.forRoot({ rootPath: clientPath, exclude: ['/api/{*path}'] })]
  : [];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ...serveStatic,
    DatabaseModule,
    NcqpModule,
    AuthModule,
    AccountModule,
    HovModule,
    HovScheduleModule,
    TransactionsModule,
    TollExceptionsModule,
    RoadGroupModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
