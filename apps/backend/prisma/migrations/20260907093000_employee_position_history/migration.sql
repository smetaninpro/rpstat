CREATE TABLE "EmployeePositionHistory" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "positionId" TEXT,
  "positionRaw" TEXT NOT NULL,
  "departmentId" TEXT,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sourceMessageId" TEXT,
  CONSTRAINT "EmployeePositionHistory_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "EmployeePositionHistory" ADD CONSTRAINT "EmployeePositionHistory_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeePositionHistory" ADD CONSTRAINT "EmployeePositionHistory_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EmployeePositionHistory" ADD CONSTRAINT "EmployeePositionHistory_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
