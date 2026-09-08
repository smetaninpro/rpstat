ALTER TYPE "MessageStatus" ADD VALUE IF NOT EXISTS 'UNKNOWN_TRAINING_TYPE';
ALTER TYPE "MessageStatus" ADD VALUE IF NOT EXISTS 'UNKNOWN_TRAINING_RESULT';
ALTER TYPE "MessageStatus" ADD VALUE IF NOT EXISTS 'MISSING_MENTIONS';

CREATE TABLE "TrainingSession" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "integrationMessageId" TEXT NOT NULL,
  "instructorEmployeeId" TEXT NOT NULL,
  "studentEmployeeId" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "overallStatus" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TrainingSession_integrationMessageId_key" ON "TrainingSession"("integrationMessageId");
CREATE TABLE "TrainingEventItem" (
  "id" TEXT NOT NULL,
  "trainingSessionId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  CONSTRAINT "TrainingEventItem_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "TrainingResult" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "trainingSessionId" TEXT NOT NULL,
  "type" TEXT,
  "status" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrainingResult_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "TrainingEventItem" ADD CONSTRAINT "TrainingEventItem_trainingSessionId_fkey" FOREIGN KEY ("trainingSessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TrainingResult" ADD CONSTRAINT "TrainingResult_trainingSessionId_fkey" FOREIGN KEY ("trainingSessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
