import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

/**
 * Prisma 7 client for the app's Postgres database. Uses the node-postgres (`pg`)
 * driver adapter (no query-engine binary). The connection string comes from
 * DATABASE_URL — a local Postgres container in dev/compose, and Neon in prod.
 * Neon speaks standard TCP Postgres with SSL (`sslmode=require` in the URL), so
 * the same adapter serves both; the Lambda container is full Node, so no
 * WebSocket/serverless driver is needed.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(config: ConfigService) {
    const connectionString = config.get<string>('DATABASE_URL');
    super({ adapter: new PrismaPg({ connectionString }) });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Connected to Postgres via node-postgres adapter');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
