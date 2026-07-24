import { applyDecorators, Injectable, SetMetadata } from '@nestjs/common';
import { DbClient } from '../../src/database/db-client';

/** Metadata key marking an injectable as a data seeder, located by the runner via DI. */
export const SEEDER = 'dataseed:seeder';

/**
 * Seeds one table: a typed collection of records that the runner upserts. Add a
 * `<table>Seeder.ts` under `seeders/` extending BaseSeeder, decorate it with
 * `@Seeder()`, and list it in DataseedModule — the seeder is discovered via DI.
 */
export interface ISeeder<T = unknown> {
  /** The records this seeder manages. */
  readonly records: readonly T[];
  /** Upsert a single record (idempotent). */
  upsert(db: DbClient, record: T): Promise<void>;
}

/** Marks an injectable class as a seeder so the runner can locate it via DI. */
export function Seeder(): ClassDecorator {
  return applyDecorators(Injectable(), SetMetadata(SEEDER, true));
}
