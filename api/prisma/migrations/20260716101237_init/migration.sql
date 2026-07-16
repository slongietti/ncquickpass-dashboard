-- CreateTable
CREATE TABLE "Credential" (
    "accountId" TEXT NOT NULL PRIMARY KEY,
    "ciphertext" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "HOVDeclaration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "transponderNumber" TEXT NOT NULL,
    "windowStart" DATETIME NOT NULL,
    "windowEnd" DATETIME NOT NULL,
    "ncqpDeclarationId" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ScheduleDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scheduleId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "ranges" JSONB NOT NULL DEFAULT [],
    CONSTRAINT "ScheduleDay_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "WeeklySchedule" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WeeklySchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "transponderNumber" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "horizonDays" INTEGER NOT NULL DEFAULT 7,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "HOVDeclaration_accountId_status_idx" ON "HOVDeclaration"("accountId", "status");

-- CreateIndex
CREATE INDEX "HOVDeclaration_scheduleId_idx" ON "HOVDeclaration"("scheduleId");

-- CreateIndex
CREATE UNIQUE INDEX "HOVDeclaration_accountId_transponderNumber_windowStart_windowEnd_key" ON "HOVDeclaration"("accountId", "transponderNumber", "windowStart", "windowEnd");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleDay_scheduleId_dayOfWeek_key" ON "ScheduleDay"("scheduleId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "WeeklySchedule_accountId_idx" ON "WeeklySchedule"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklySchedule_accountId_transponderNumber_key" ON "WeeklySchedule"("accountId", "transponderNumber");
