import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { RoadGroupSeeder } from './seeders/roadGroupSeeder';

/**
 * Registers the data seeders. Add a `@Seeder()` class under `seeders/` and list
 * it here — the seed entry discovers them all via the DI container. DbClient
 * comes from the global DatabaseModule.
 */
@Module({
  imports: [DiscoveryModule],
  providers: [RoadGroupSeeder],
})
export class DataseedModule {}
