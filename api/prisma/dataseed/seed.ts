import 'reflect-metadata';
import 'dotenv/config';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DiscoveryService, NestFactory, Reflector } from '@nestjs/core';
import { DatabaseModule } from '../../src/database/database.module';
import { DbClient } from '../../src/database/db-client';
import { DataseedModule } from './dataseedModule';
import { ISeeder, SEEDER } from './seeder';

/** Minimal context: the global config + database, plus the seeders. */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule, DataseedModule],
})
class SeedContextModule {}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(SeedContextModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const discovery = app.get(DiscoveryService);
    const reflector = app.get(Reflector);
    const db = app.get(DbClient);

    const seeders = discovery
      .getProviders()
      .filter((w) => w.metatype && w.instance && reflector.get(SEEDER, w.metatype) === true)
      .map((w) => w.instance as ISeeder);

    for (const seeder of seeders) {
      for (const record of seeder.records) {
        await seeder.upsert(db, record);
      }
      const entity = seeder.constructor.name.replace(/Seeder$/, '');
      console.log(`Seeded ${seeder.records.length} ${entity} record(s).`);
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
