import { Injectable, Logger } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { DbClient } from '../../src/database/db-client';
import { ISeeder, SEEDER } from './seeder';

/**
 * Locates every `@Seeder()` provider through the DI container and upserts each
 * one's records using the injected DbClient — no manual connection handling.
 */
@Injectable()
export class SeederRunner {
  private readonly logger = new Logger(SeederRunner.name);

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
    private readonly db: DbClient,
  ) {}

  async run(): Promise<void> {
    const seeders = this.discovery
      .getProviders()
      .filter((w) => w.metatype && w.instance && this.reflector.get(SEEDER, w.metatype) === true)
      .map((w) => w.instance as ISeeder);

    for (const seeder of seeders) {
      for (const record of seeder.records) {
        await seeder.upsert(this.db, record);
      }
      const entity = seeder.constructor.name.replace(/Seeder$/, '');
      this.logger.log(`Seeded ${seeder.records.length} ${entity} record(s).`);
    }
  }
}
