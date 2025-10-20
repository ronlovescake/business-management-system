-- CreateTable
CREATE TABLE "cash_advances" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "employeeId" VARCHAR(50) NOT NULL,
    "employeeName" VARCHAR(255) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "termsMonths" INTEGER,
    "monthlyPayment" DECIMAL(12,2),
    "settledAmount" DECIMAL(12,2),
    "remainingBalance" DECIMAL(12,2),
    "purpose" VARCHAR(255),
    "notes" TEXT,
    "requestDate" TIMESTAMP(3),
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "approvedBy" VARCHAR(255),
    "approvedDate" TIMESTAMP(3),
    "rejectedBy" VARCHAR(255),
    "rejectedDate" TIMESTAMP(3),
    "rejectionReason" TEXT,

    CONSTRAINT "cash_advances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cash_advances_employeeId_idx" ON "cash_advances"("employeeId");

-- CreateIndex
CREATE INDEX "cash_advances_status_idx" ON "cash_advances"("status");

-- CreateIndex
CREATE INDEX "cash_advances_requestDate_idx" ON "cash_advances"("requestDate");
