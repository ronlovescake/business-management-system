BEGIN;

ALTER TABLE general_merchandise.customers
  ADD COLUMN IF NOT EXISTS "clothingCustomerId" INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS "customers_clothingCustomerId_key"
  ON general_merchandise.customers("clothingCustomerId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'customers_clothingCustomerId_fkey'
      AND conrelid = 'general_merchandise.customers'::regclass
  ) THEN
    ALTER TABLE general_merchandise.customers
      ADD CONSTRAINT "customers_clothingCustomerId_fkey"
      FOREIGN KEY ("clothingCustomerId")
      REFERENCES public."Customer"(id)
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END;
$$;

WITH unique_clothing_customers AS (
  SELECT "customerName", MIN(id) AS id
  FROM public."Customer"
  WHERE btrim("customerName") <> ''
  GROUP BY "customerName"
  HAVING COUNT(*) = 1
), unique_gm_customers AS (
  SELECT "customerName"
  FROM general_merchandise.customers
  WHERE btrim("customerName") <> ''
  GROUP BY "customerName"
  HAVING COUNT(*) = 1
)
UPDATE general_merchandise.customers AS gm
SET "clothingCustomerId" = clothing.id
FROM unique_clothing_customers AS clothing
JOIN unique_gm_customers AS unique_gm USING ("customerName")
WHERE gm."clothingCustomerId" IS NULL
  AND gm."customerName" = clothing."customerName";

WITH unique_gm_customers AS (
  SELECT "customerName", MIN(id) AS id
  FROM general_merchandise.customers
  WHERE btrim("customerName") <> ''
  GROUP BY "customerName"
  HAVING COUNT(*) = 1
)
UPDATE general_merchandise.transactions AS txn
SET "customerId" = customer.id
FROM unique_gm_customers AS customer
WHERE txn."customerId" IS NULL
  AND txn.customers = customer."customerName";

CREATE OR REPLACE FUNCTION public.sync_gm_customer_name_from_clothing()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE general_merchandise.customers
  SET "customerName" = NEW."customerName",
      "updatedAt" = CURRENT_TIMESTAMP
  WHERE "clothingCustomerId" = NEW.id
    AND "customerName" IS DISTINCT FROM NEW."customerName";
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clothing_customer_gm_name ON public."Customer";
CREATE TRIGGER clothing_customer_gm_name
AFTER UPDATE OF "customerName" ON public."Customer"
FOR EACH ROW
WHEN (OLD."customerName" IS DISTINCT FROM NEW."customerName")
EXECUTE FUNCTION public.sync_gm_customer_name_from_clothing();

COMMIT;