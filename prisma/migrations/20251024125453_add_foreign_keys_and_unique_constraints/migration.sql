-- CreateTable
CREATE TABLE "thirteenth_month_pay_records" (
    "id" TEXT NOT NULL,
    "recordId" VARCHAR(150) NOT NULL,
    "employeeId" VARCHAR(50),
    "employeeName" VARCHAR(255) NOT NULL,
    "year" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'calculated',
    "totalBasicSalary" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalLwop" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalAbsencesLates" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "netBasicSalary" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "monthsWorked" INTEGER NOT NULL DEFAULT 1,
    "thirteenthMonthPay" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "calculatedDate" VARCHAR(50),
    "approvedDate" VARCHAR(50),
    "paidDate" VARCHAR(50),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "thirteenth_month_pay_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "thirteenth_month_pay_records_recordId_key" ON "thirteenth_month_pay_records"("recordId");

-- CreateIndex
CREATE INDEX "thirteenth_month_pay_records_year_idx" ON "thirteenth_month_pay_records"("year");

-- CreateIndex
CREATE INDEX "thirteenth_month_pay_records_status_idx" ON "thirteenth_month_pay_records"("status");
