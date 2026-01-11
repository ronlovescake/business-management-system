-- Baseline safety: ensure HouseholdAccounts exists (non-destructive)
-- Uses IF NOT EXISTS to avoid impacting live data.

CREATE TABLE IF NOT EXISTS "HouseholdAccounts" (
    "id" TEXT PRIMARY KEY,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" VARCHAR(255) NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "institution" VARCHAR(255),
    "accountNumberLast4" VARCHAR(10),
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS "HouseholdAccounts_name_idx" ON "HouseholdAccounts"("name");
CREATE INDEX IF NOT EXISTS "HouseholdAccounts_type_idx" ON "HouseholdAccounts"("type");
CREATE INDEX IF NOT EXISTS "HouseholdAccounts_isActive_idx" ON "HouseholdAccounts"("isActive");
