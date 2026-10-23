ALTER TABLE "public"."inventory_movements"
ADD COLUMN "unitCost" DOUBLE PRECISION;

ALTER TABLE "general_merchandise"."inventory_movements"
ADD COLUMN "unitCost" DOUBLE PRECISION;