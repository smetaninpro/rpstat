ALTER TABLE "ExamAttempt" ADD COLUMN "questionOrder" JSONB NOT NULL DEFAULT '[]';

CREATE TABLE "ExamQuestion" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExamQuestion_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ExamQuestionOption" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ExamQuestionOption_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ExamQuestionOption_questionId_sortOrder_idx" ON "ExamQuestionOption"("questionId", "sortOrder");
ALTER TABLE "ExamQuestionOption" ADD CONSTRAINT "ExamQuestionOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "ExamQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
