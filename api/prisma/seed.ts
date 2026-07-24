import 'reflect-metadata';
import 'dotenv/config';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DatabaseModule } from '../src/database/database.module';
import { DataseedModule } from './dataseed/dataseedModule';
import { SeederRunner } from './dataseed/seederRunner';

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
    await app.get(SeederRunner).run();
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
