import { applyDecorators, Injectable, SetMetadata } from '@nestjs/common';
import { DbClient } from '../../src/database/db-client';

/** Metadata key marking an injectable as a data seeder, located by the runner via DI. */
export const SEEDER = 'dataseed:seeder';

/**
 * Seeds one table: a typed collection of records and how to upsert one. Generic
 * over the record type `T` so every implementation is type-checked against its
 * own records. Decorate the class with `@Seeder()` and register it as a provider
 * in DataseedModule — the runner discovers it through the DI container.
 */
export interface ISeeder<T = unknown> {
  /** The records this seeder manages. */
  readonly records: readonly T[];
  /** Upsert a single record (idempotent). */
  upsert(db: DbClient, record: T): Promise<void>;
}

/** Marks an injectable class as an ISeeder so the runner can locate it via DI. */
export function Seeder(): ClassDecorator {
  return applyDecorators(Injectable(), SetMetadata(SEEDER, true));
}
