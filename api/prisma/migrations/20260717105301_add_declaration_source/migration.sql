-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_HOVDeclaration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "scheduleId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'weekly',
    "transponderNumber" TEXT NOT NULL,
    "windowStart" DATETIME NOT NULL,
    "windowEnd" DATETIME NOT NULL,
    "ncqpDeclarationId" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_HOVDeclaration" ("accountId", "createdAt", "id", "ncqpDeclarationId", "scheduleId", "status", "transponderNumber", "windowEnd", "windowStart") SELECT "accountId", "createdAt", "id", "ncqpDeclarationId", "scheduleId", "status", "transponderNumber", "windowEnd", "windowStart" FROM "HOVDeclaration";
DROP TABLE "HOVDeclaration";
ALTER TABLE "new_HOVDeclaration" RENAME TO "HOVDeclaration";
CREATE INDEX "HOVDeclaration_accountId_status_idx" ON "HOVDeclaration"("accountId", "status");
CREATE INDEX "HOVDeclaration_scheduleId_idx" ON "HOVDeclaration"("scheduleId");
CREATE UNIQUE INDEX "HOVDeclaration_accountId_transponderNumber_windowStart_windowEnd_key" ON "HOVDeclaration"("accountId", "transponderNumber", "windowStart", "windowEnd");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
