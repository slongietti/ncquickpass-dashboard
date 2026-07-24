import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

/**
 * Canonical road-group records. Add a road or keyword here and re-run
 * `npm run db:seed` — upserts are idempotent, so it's safe to run anytime.
 */
const ROAD_GROUPS = [
  {
    id: 'i77-express',
    label: 'I-77 Express Lanes',
    keywords: ['77 EL'],
    hovEligible: true,
    sortOrder: 0,
  },
];

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    for (const group of ROAD_GROUPS) {
      await prisma.roadGroup.upsert({
        where: { id: group.id },
        create: group,
        update: {
          label: group.label,
          keywords: group.keywords,
          hovEligible: group.hovEligible,
          sortOrder: group.sortOrder,
        },
      });
    }
    console.log(`Seeded ${ROAD_GROUPS.length} road group(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
