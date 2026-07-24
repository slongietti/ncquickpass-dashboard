import { DbClient } from '../../../src/database/db-client';
import { Prisma } from '../../../src/generated/prisma/client';
import { BaseSeeder, Seeder, UpsertModel } from '../seeder';

/**
 * Canonical road groups. Add a road or keyword to `records` and re-run
 * `npm run db:seed` — upserts are idempotent, so it's safe to run anytime.
 */
@Seeder()
export class RoadGroupSeeder extends BaseSeeder<
  Prisma.RoadGroupCreateInput,
  Prisma.RoadGroupWhereUniqueInput
> {
  readonly records: readonly Prisma.RoadGroupCreateInput[] = [
    { id: 'i77-express', label: 'I-77', keywords: ['77 EL'], hovEligible: true, sortOrder: 0 },
  ];

  protected model(
    db: DbClient,
  ): UpsertModel<Prisma.RoadGroupCreateInput, Prisma.RoadGroupWhereUniqueInput> {
    return db.roadGroup;
  }

  protected whereOf(record: Prisma.RoadGroupCreateInput): Prisma.RoadGroupWhereUniqueInput {
    return { id: record.id };
  }
}
