-- CreateEnum
CREATE TYPE "CashAdvanceCycle" AS ENUM ('FIRST_HALF', 'SECOND_HALF');

-- AlterTable
ALTER TABLE "cash_advances" ADD COLUMN     "deductionCycle" "CashAdvanceCycle",
ADD COLUMN     "lastDeductedDate" TIMESTAMP(3),
ADD COLUMN     "nextDeductionDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "cash_advance_deductions" (
    "id" TEXT NOT NULL,
    "cashAdvanceId" TEXT NOT NULL,
    "employeeId" VARCHAR(50) NOT NULL,
    "payrollId" TEXT,
    "payPeriod" VARCHAR(100),
    "deductionDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_advance_deductions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cash_advance_deductions_cashAdvanceId_idx" ON "cash_advance_deductions"("cashAdvanceId");

-- CreateIndex
CREATE INDEX "cash_advance_deductions_employeeId_idx" ON "cash_advance_deductions"("employeeId");

-- AddForeignKey
ALTER TABLE "cash_advance_deductions" ADD CONSTRAINT "cash_advance_deductions_cashAdvanceId_fkey" FOREIGN KEY ("cashAdvanceId") REFERENCES "cash_advances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
