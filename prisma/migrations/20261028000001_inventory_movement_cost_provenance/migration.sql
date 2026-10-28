ALTER TABLE "public"."inventory_movements"
  ADD COLUMN "costBasis" VARCHAR(30),
  ADD COLUMN "sourceMovementId" INTEGER;

CREATE INDEX "inventory_movements_sourceMovementId_idx"
  ON "public"."inventory_movements"("sourceMovementId");

ALTER TABLE "public"."inventory_movements"
  ADD CONSTRAINT "inventory_movements_sourceMovementId_fkey"
  FOREIGN KEY ("sourceMovementId") REFERENCES "public"."inventory_movements"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
