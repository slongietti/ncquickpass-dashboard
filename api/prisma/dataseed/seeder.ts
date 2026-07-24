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

/** The slice of a Prisma model delegate a seeder needs (idempotent upsert). */
export interface UpsertModel<TCreate, TWhere> {
  upsert(args: { where: TWhere; create: TCreate; update: TCreate }): PromiseLike<unknown>;
}

/**
 * Base seeder: implements the record→upsert once for every table. Subclasses only
 * declare their `records`, the Prisma `model(db)` to write to, and the unique
 * `whereOf(record)` selector. Create and update use the same record (idempotent).
 */
export abstract class BaseSeeder<TCreate, TWhere> implements ISeeder<TCreate> {
  abstract readonly records: readonly TCreate[];

  /** The Prisma delegate for this table, e.g. `db.roadGroup`. */
  protected abstract model(db: DbClient): UpsertModel<TCreate, TWhere>;

  /** The unique-where selector for a record, e.g. `{ id: record.id }`. */
  protected abstract whereOf(record: TCreate): TWhere;

  async upsert(db: DbClient, record: TCreate): Promise<void> {
    await this.model(db).upsert({ where: this.whereOf(record), create: record, update: record });
  }
}

/** Marks an injectable class as a seeder so the runner can locate it via DI. */
export function Seeder(): ClassDecorator {
  return applyDecorators(Injectable(), SetMetadata(SEEDER, true));
}
