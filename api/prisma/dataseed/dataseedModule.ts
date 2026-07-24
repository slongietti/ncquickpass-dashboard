import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { RoadGroupSeeder } from './roadGroupSeeder';
import { SeederRunner } from './seederRunner';

/**
 * Registers the data seeders and the DI-based runner. Add a new seeder by
 * creating a `@Seeder()` class and listing it in `providers` — the runner
 * discovers it automatically. DbClient comes from the global DatabaseModule.
 */
@Module({
  imports: [DiscoveryModule],
  providers: [SeederRunner, RoadGroupSeeder],
})
export class DataseedModule {}
