CREATE TYPE "ExamStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'TERMINATED');

CREATE TABLE "ExamAdmission" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "examCode" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamAdmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExamAttempt" (
    "id" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "status" "ExamStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "currentQuestion" INTEGER NOT NULL DEFAULT 0,
    "questionStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answers" JSONB NOT NULL DEFAULT '[]',
    "score" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "ExamAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExamAdmission_examCode_key" ON "ExamAdmission"("examCode");
CREATE INDEX "ExamAdmission_lastName_firstName_idx" ON "ExamAdmission"("lastName", "firstName");
CREATE INDEX "ExamAttempt_admissionId_status_idx" ON "ExamAttempt"("admissionId", "status");
ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "ExamAdmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;


INSERT INTO "ExamAdmission" ("id", "firstName", "lastName", "examCode") VALUES ('7ed8b1d5-9841-4e8a-8c35-ef20e5ce0d2c', 'Иван', 'Иванов', '111-111') ON CONFLICT ("examCode") DO NOTHING;
