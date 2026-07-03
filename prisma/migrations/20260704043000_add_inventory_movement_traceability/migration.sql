-- 2026-07-04: Add explicit traceability fields for inventory movements.
-- This migration is purely additive:
--   * Adds nullable source transaction and movement classification fields.
--   * Adds indexes used by COGS/accounting lookup helpers.
-- It does NOT drop, rename, rewrite, or backfill existing rows.

-- ---------------------------------------------------------------------------
-- Clothing inventory movements (public.inventory_movements)
-- ---------------------------------------------------------------------------
ALTER TABLE "public"."inventory_movements"
  ADD COLUMN IF NOT EXISTS "sourceTransactionId" INTEGER,
  ADD COLUMN IF NOT EXISTS "movementSource" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "movementType" VARCHAR(50);

CREATE INDEX IF NOT EXISTS "inventory_movements_sourceTransactionId_idx"
  ON "public"."inventory_movements"("sourceTransactionId");

CREATE INDEX IF NOT EXISTS "inventory_movements_movementSource_movementType_idx"
  ON "public"."inventory_movements"("movementSource", "movementType");

-- ---------------------------------------------------------------------------
-- General merchandise inventory movements
--   (general_merchandise.inventory_movements)
-- ---------------------------------------------------------------------------
ALTER TABLE "general_merchandise"."inventory_movements"
  ADD COLUMN IF NOT EXISTS "sourceTransactionId" INTEGER,
  ADD COLUMN IF NOT EXISTS "movementSource" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "movementType" VARCHAR(50);

CREATE INDEX IF NOT EXISTS "gm_inventory_movements_sourceTransactionId_idx"
  ON "general_merchandise"."inventory_movements"("sourceTransactionId");

CREATE INDEX IF NOT EXISTS "gm_inventory_movements_movementSource_movementType_idx"
  ON "general_merchandise"."inventory_movements"("movementSource", "movementType");
