import { DbClient } from '../../src/database/db-client';
import { ISeeder, Seeder } from './seeder';

interface RoadGroupRecord {
  id: string;
  label: string;
  keywords: string[];
  hovEligible: boolean;
  sortOrder: number;
}

/**
 * Canonical road groups. Add a road or keyword to `records` and re-run
 * `npm run db:seed` — upserts are idempotent, so it's safe to run anytime.
 */
@Seeder()
export class RoadGroupSeeder implements ISeeder<RoadGroupRecord> {
  readonly records: readonly RoadGroupRecord[] = [
    { id: 'i77-express', label: 'I-77', keywords: ['77 EL'], hovEligible: true, sortOrder: 0 },
  ];

  async upsert(db: DbClient, record: RoadGroupRecord): Promise<void> {
    await db.roadGroup.upsert({
      where: { id: record.id },
      create: record,
      update: {
        label: record.label,
        keywords: record.keywords,
        hovEligible: record.hovEligible,
        sortOrder: record.sortOrder,
      },
    });
  }
}
