-- CreateTable
CREATE TABLE "payrolls" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "employeeId" VARCHAR(50) NOT NULL,
    "employeeName" VARCHAR(255) NOT NULL,
    "payPeriod" VARCHAR(50) NOT NULL,
    "periodStart" VARCHAR(50) NOT NULL,
    "periodEnd" VARCHAR(50) NOT NULL,
    "basicSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "allowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overtime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bonuses" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grossPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sss" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "philHealth" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pagIbig" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "loans" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "others" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "bankGcash" VARCHAR(255) NOT NULL,
    "approvedBy" VARCHAR(255),
    "approvedDate" VARCHAR(50),
    "paidDate" VARCHAR(50),
    "unpaidDays" INTEGER NOT NULL DEFAULT 0,
    "dailyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "payrolls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payrolls_employeeId_idx" ON "payrolls"("employeeId");

-- CreateIndex
CREATE INDEX "payrolls_employeeName_idx" ON "payrolls"("employeeName");

-- CreateIndex
CREATE INDEX "payrolls_payPeriod_idx" ON "payrolls"("payPeriod");

-- CreateIndex
CREATE INDEX "payrolls_periodStart_idx" ON "payrolls"("periodStart");

-- CreateIndex
CREATE INDEX "payrolls_status_idx" ON "payrolls"("status");

-- CreateIndex
CREATE INDEX "payrolls_deletedAt_idx" ON "payrolls"("deletedAt");
