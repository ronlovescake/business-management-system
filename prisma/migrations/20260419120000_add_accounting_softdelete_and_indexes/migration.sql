-- 2026-04-19: Soft-delete columns on accounting models + composite indexes
-- This migration is purely additive:
--   * Adds nullable `deletedAt` columns to the four accounting tables.
--   * Adds an index on each new `deletedAt` column.
--   * Adds three composite indexes for hot-path queries on `transactions`,
--     `expenses`, and `shipments`.
-- It does NOT drop, rename, or rewrite any existing columns or rows.

-- ---------------------------------------------------------------------------
-- ClothingAccountingOpeningBalance (public.\"ClothingAccountingOpeningBalance\")
-- ---------------------------------------------------------------------------
ALTER TABLE "public"."ClothingAccountingOpeningBalance"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "ClothingAccountingOpeningBalance_deletedAt_idx"
  ON "public"."ClothingAccountingOpeningBalance"("deletedAt");

-- ---------------------------------------------------------------------------
-- ClothingAccountingJournalLine (public.clothing_accounting_journal_lines)
-- ---------------------------------------------------------------------------
ALTER TABLE "public"."clothing_accounting_journal_lines"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "clothing_accounting_journal_lines_deletedAt_idx"
  ON "public"."clothing_accounting_journal_lines"("deletedAt");

-- ---------------------------------------------------------------------------
-- GeneralMerchandiseAccountingOpeningBalance
--   (general_merchandise.accounting_opening_balance)
-- ---------------------------------------------------------------------------
ALTER TABLE "general_merchandise"."accounting_opening_balance"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "accounting_opening_balance_deletedAt_idx"
  ON "general_merchandise"."accounting_opening_balance"("deletedAt");

-- ---------------------------------------------------------------------------
-- GeneralMerchandiseAccountingJournalLine
--   (general_merchandise.accounting_journal_lines)
-- ---------------------------------------------------------------------------
ALTER TABLE "general_merchandise"."accounting_journal_lines"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "accounting_journal_lines_deletedAt_idx"
  ON "general_merchandise"."accounting_journal_lines"("deletedAt");

-- ---------------------------------------------------------------------------
-- Composite indexes for hot-path queries
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "transactions_productCode_orderStatus_idx"
  ON "public"."transactions"("productCode", "orderStatus");

CREATE INDEX IF NOT EXISTS "expenses_employeeName_date_idx"
  ON "public"."expenses"("employeeName", "date");

CREATE INDEX IF NOT EXISTS "shipments_shipmentStatus_dateCreated_idx"
  ON "public"."shipments"("shipmentStatus", "dateCreated");
