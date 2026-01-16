-- Manual reconciliation: Prisma drift fixes (non-destructive)
--
-- Goal:
-- - Bring the live DB into alignment with prisma/schema.prisma and existing migration expectations
-- - Avoid any destructive resets / table drops
--
-- Notes:
-- - This script is idempotent (safe to run multiple times)
-- - It only does:
--   - Add missing enum values
--   - Rename indexes to Prisma's expected names
--   - Replace a foreign key constraint with the expected name/options

-- 1) InventoryBucket enum values (additive)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'InventoryBucket' AND e.enumlabel = 'reserved'
  ) THEN
    EXECUTE 'ALTER TYPE "InventoryBucket" ADD VALUE ''reserved''';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'InventoryBucket' AND e.enumlabel = 'assembly_wip'
  ) THEN
    EXECUTE 'ALTER TYPE "InventoryBucket" ADD VALUE ''assembly_wip''';
  END IF;
END $$;

-- 2) Recurring drafts FK: keep ON DELETE CASCADE, ensure expected name + ON UPDATE CASCADE
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clothing_recurring_payment_drafts_template_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "clothing_recurring_payment_drafts" DROP CONSTRAINT "clothing_recurring_payment_drafts_template_fkey"';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clothing_recurring_payment_drafts_templateId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "clothing_recurring_payment_drafts" ADD CONSTRAINT "clothing_recurring_payment_drafts_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "clothing_recurring_payment_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE';
  END IF;
END $$;

-- 3) Index renames (non-destructive)
DO $$
BEGIN
  -- clothing_accounting_journal_lines
  IF to_regclass('public.clothing_accounting_journal_lines_source_unique') IS NOT NULL
     AND to_regclass('public."clothing_accounting_journal_lines_sourceType_sourceId_sourc_key"') IS NULL THEN
    EXECUTE 'ALTER INDEX "clothing_accounting_journal_lines_source_unique" RENAME TO "clothing_accounting_journal_lines_sourceType_sourceId_sourc_key"';
  END IF;

  IF to_regclass('public.clothing_accounting_journal_lines_sourceid_idx') IS NOT NULL
     AND to_regclass('public."clothing_accounting_journal_lines_sourceId_idx"') IS NULL THEN
    EXECUTE 'ALTER INDEX "clothing_accounting_journal_lines_sourceid_idx" RENAME TO "clothing_accounting_journal_lines_sourceId_idx"';
  END IF;

  IF to_regclass('public.clothing_accounting_journal_lines_sourcetype_idx') IS NOT NULL
     AND to_regclass('public."clothing_accounting_journal_lines_sourceType_idx"') IS NULL THEN
    EXECUTE 'ALTER INDEX "clothing_accounting_journal_lines_sourcetype_idx" RENAME TO "clothing_accounting_journal_lines_sourceType_idx"';
  END IF;

  -- clothing_recurring_payment_drafts
  IF to_regclass('public.clothing_recurring_payment_drafts_due_date_idx') IS NOT NULL
      AND to_regclass('public."clothing_recurring_payment_drafts_dueDate_idx"') IS NULL THEN
    EXECUTE 'ALTER INDEX "clothing_recurring_payment_drafts_due_date_idx" RENAME TO "clothing_recurring_payment_drafts_dueDate_idx"';
  END IF;

  IF to_regclass('public.clothing_recurring_payment_drafts_template_due_unique') IS NOT NULL
      AND to_regclass('public."clothing_recurring_payment_drafts_templateId_dueDate_key"') IS NULL THEN
    EXECUTE 'ALTER INDEX "clothing_recurring_payment_drafts_template_due_unique" RENAME TO "clothing_recurring_payment_drafts_templateId_dueDate_key"';
  END IF;

  IF to_regclass('public.clothing_recurring_payment_drafts_template_id_idx') IS NOT NULL
      AND to_regclass('public."clothing_recurring_payment_drafts_templateId_idx"') IS NULL THEN
    EXECUTE 'ALTER INDEX "clothing_recurring_payment_drafts_template_id_idx" RENAME TO "clothing_recurring_payment_drafts_templateId_idx"';
  END IF;

  -- clothing_recurring_payment_templates
  IF to_regclass('public.clothing_recurring_payment_templates_is_active_idx') IS NOT NULL
     AND to_regclass('public."clothing_recurring_payment_templates_isActive_idx"') IS NULL THEN
    EXECUTE 'ALTER INDEX "clothing_recurring_payment_templates_is_active_idx" RENAME TO "clothing_recurring_payment_templates_isActive_idx"';
  END IF;

  IF to_regclass('public.clothing_recurring_payment_templates_next_due_date_idx') IS NOT NULL
     AND to_regclass('public."clothing_recurring_payment_templates_nextDueDate_idx"') IS NULL THEN
    EXECUTE 'ALTER INDEX "clothing_recurring_payment_templates_next_due_date_idx" RENAME TO "clothing_recurring_payment_templates_nextDueDate_idx"';
  END IF;
END $$;
