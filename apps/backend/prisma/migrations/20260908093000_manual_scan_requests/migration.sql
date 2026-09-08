CREATE TYPE "ScanRequestStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

CREATE TABLE "ScanRequest" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT,
  "requestedBy" TEXT NOT NULL,
  "recentDays" INTEGER NOT NULL DEFAULT 3,
  "limit" INTEGER NOT NULL DEFAULT 20,
  "status" "ScanRequestStatus" NOT NULL DEFAULT 'PENDING',
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "result" JSONB,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScanRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScanRequest_status_createdAt_idx" ON "ScanRequest"("status", "createdAt");
ALTER TABLE "ScanRequest" ADD CONSTRAINT "ScanRequest_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DiscordSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
