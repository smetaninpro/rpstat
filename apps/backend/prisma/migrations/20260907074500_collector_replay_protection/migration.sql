CREATE TABLE "CollectorRequest" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CollectorRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CollectorRequest_requestId_key" ON "CollectorRequest"("requestId");
