-- CreateTable
CREATE TABLE "RoadGroup" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "keywords" TEXT[],
    "hovEligible" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoadGroup_pkey" PRIMARY KEY ("id")
);

-- Seed the baseline road group so classification works in every environment
-- (dev, CI, prod). Idempotent; the prisma/seed.ts dataseed keeps the full list.
INSERT INTO "RoadGroup" ("id", "label", "keywords", "hovEligible", "sortOrder", "updatedAt")
VALUES ('i77-express', 'I-77 Express Lanes', ARRAY['77 EL'], true, 0, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
