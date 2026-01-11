-- Add HouseholdBudget table (non-destructive, additive only)
-- Links to HouseholdAccounts via nullable FK; no existing data is modified.

CREATE TABLE "HouseholdBudget" (
    "id" TEXT PRIMARY KEY,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" VARCHAR(100) NOT NULL,
    "period" VARCHAR(20) NOT NULL,
    "year" INTEGER,
    "month" INTEGER,
    "plannedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "actualAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "accountId" TEXT,
    "notes" VARCHAR(500)
);

CREATE INDEX "HouseholdBudget_category_idx" ON "HouseholdBudget"("category");
CREATE INDEX "HouseholdBudget_period_idx" ON "HouseholdBudget"("period");
CREATE INDEX "HouseholdBudget_year_month_idx" ON "HouseholdBudget"("year", "month");
CREATE INDEX "HouseholdBudget_accountId_idx" ON "HouseholdBudget"("accountId");

ALTER TABLE "HouseholdBudget"
  ADD CONSTRAINT "HouseholdBudget_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "HouseholdAccounts"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
