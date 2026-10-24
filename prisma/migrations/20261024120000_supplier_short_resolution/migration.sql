BEGIN;

ALTER TABLE public.inventory_movements
  ADD COLUMN "supplierShortResolution" VARCHAR(30),
  ADD COLUMN "supplierShortExpectedShipmentCode" VARCHAR(100),
  ADD COLUMN "supplierCreditReference" VARCHAR(150),
  ADD COLUMN "supplierCreditAmount" DOUBLE PRECISION;

UPDATE public.inventory_movements
SET "supplierShortResolution" = 'UNRESOLVED'
WHERE "fromBucket" = 'sellable'
  AND "toBucket" = 'supplier_short'
  AND lower(coalesce(notes, '')) NOT LIKE 'additionals%'
  AND lower(coalesce(notes, '')) NOT LIKE 'transfer%';

ALTER TABLE public.inventory_movements
  ADD CONSTRAINT inventory_movements_supplier_short_resolution_check
  CHECK (
    "supplierShortResolution" IS NULL OR
    "supplierShortResolution" IN (
      'UNRESOLVED',
      'EXPECTED_LATER',
      'CREDIT_PENDING',
      'CREDIT_RECEIVED',
      'CREDIT_APPLIED'
    )
  ),
  ADD CONSTRAINT inventory_movements_supplier_credit_amount_check
  CHECK ("supplierCreditAmount" IS NULL OR "supplierCreditAmount" >= 0);

COMMIT;
