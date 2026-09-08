CREATE TABLE "EmployeeRankHistory" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "rankId" TEXT NOT NULL,
  "assignedBy" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedAt" TIMESTAMP(3),
  CONSTRAINT "EmployeeRankHistory_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "EmployeeRankHistory" ADD CONSTRAINT "EmployeeRankHistory_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeRankHistory" ADD CONSTRAINT "EmployeeRankHistory_rankId_fkey" FOREIGN KEY ("rankId") REFERENCES "Rank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
