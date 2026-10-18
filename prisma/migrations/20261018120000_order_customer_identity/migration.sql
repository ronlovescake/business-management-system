BEGIN;

LOCK TABLE public."Customer", general_merchandise.customers IN SHARE ROW EXCLUSIVE MODE;

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS "customerId" INTEGER;
ALTER TABLE general_merchandise.transactions ADD COLUMN IF NOT EXISTS "customerId" INTEGER;

CREATE INDEX IF NOT EXISTS "transactions_customerId_idx" ON public.transactions("customerId");
CREATE INDEX IF NOT EXISTS "transactions_customerId_idx" ON general_merchandise.transactions("customerId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_customerId_fkey' AND conrelid = 'public.transactions'::regclass) THEN
    ALTER TABLE public.transactions ADD CONSTRAINT "transactions_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES public."Customer"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transactions_customerId_fkey' AND conrelid = 'general_merchandise.transactions'::regclass) THEN
    ALTER TABLE general_merchandise.transactions ADD CONSTRAINT "transactions_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES general_merchandise.customers(id) ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END;
$$;

UPDATE public.transactions AS orders
SET "customerId" = matched.id
FROM (
  SELECT "customerName", MIN(id) AS id FROM public."Customer"
  WHERE btrim("customerName") <> ''
  GROUP BY "customerName" HAVING COUNT(*) = 1
) AS matched
WHERE orders."customerId" IS NULL AND orders.customers = matched."customerName";

UPDATE general_merchandise.transactions AS orders
SET "customerId" = matched.id
FROM (
  SELECT "customerName", MIN(id) AS id FROM general_merchandise.customers
  WHERE btrim("customerName") <> ''
  GROUP BY "customerName" HAVING COUNT(*) = 1
) AS matched
WHERE orders."customerId" IS NULL AND orders.customers = matched."customerName";

CREATE OR REPLACE FUNCTION public.resolve_order_customer_identity() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  customer_table text;
  linked_name text;
  match_count bigint;
  matched_id integer;
BEGIN
  customer_table := CASE WHEN TG_TABLE_SCHEMA = 'public' THEN 'Customer' ELSE 'customers' END;

  IF NEW."customerId" IS NOT NULL THEN
    EXECUTE format('SELECT "customerName" FROM %I.%I WHERE id = $1 FOR SHARE', TG_TABLE_SCHEMA, customer_table)
      INTO linked_name USING NEW."customerId";
    IF linked_name IS NULL THEN
      RAISE EXCEPTION 'Customer ID % does not exist in this business', NEW."customerId" USING ERRCODE = '23503';
    END IF;

    IF TG_OP = 'INSERT' THEN
      NEW.customers := linked_name;
      RETURN NEW;
    END IF;
    IF NEW."customerId" IS DISTINCT FROM OLD."customerId"
      OR NEW.customers IS NOT DISTINCT FROM linked_name
      OR NEW.customers IS NOT DISTINCT FROM OLD.customers THEN
      NEW.customers := linked_name;
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.customers IS NULL OR btrim(NEW.customers) = '' THEN
    NEW."customerId" := NULL;
    RETURN NEW;
  END IF;

  EXECUTE format('SELECT COUNT(*), MIN(id) FROM %I.%I WHERE "customerName" = $1', TG_TABLE_SCHEMA, customer_table)
    INTO match_count, matched_id USING NEW.customers;

  IF match_count = 1 THEN
    EXECUTE format('SELECT "customerName" FROM %I.%I WHERE id = $1 FOR SHARE', TG_TABLE_SCHEMA, customer_table)
      INTO linked_name USING matched_id;
    NEW."customerId" := matched_id;
    NEW.customers := linked_name;
  ELSE
    IF TG_OP = 'UPDATE' THEN
      IF OLD."customerId" IS NOT NULL THEN
        RAISE EXCEPTION 'Customer name is missing or ambiguous; reload the order and select a unique customer'
          USING ERRCODE = '23514';
      END IF;
    END IF;
    NEW."customerId" := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_order_customer_name() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('UPDATE %I.transactions SET customers = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE "customerId" = $2', TG_TABLE_SCHEMA)
    USING NEW."customerName", NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_customer_identity ON public.transactions;
CREATE TRIGGER order_customer_identity
BEFORE INSERT OR UPDATE OF customers, "customerId" ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.resolve_order_customer_identity();

DROP TRIGGER IF EXISTS order_customer_identity ON general_merchandise.transactions;
CREATE TRIGGER order_customer_identity
BEFORE INSERT OR UPDATE OF customers, "customerId" ON general_merchandise.transactions
FOR EACH ROW EXECUTE FUNCTION public.resolve_order_customer_identity();

DROP TRIGGER IF EXISTS customer_order_names ON public."Customer";
CREATE TRIGGER customer_order_names
AFTER UPDATE OF "customerName" ON public."Customer"
FOR EACH ROW WHEN (OLD."customerName" IS DISTINCT FROM NEW."customerName")
EXECUTE FUNCTION public.sync_order_customer_name();

DROP TRIGGER IF EXISTS customer_order_names ON general_merchandise.customers;
CREATE TRIGGER customer_order_names
AFTER UPDATE OF "customerName" ON general_merchandise.customers
FOR EACH ROW WHEN (OLD."customerName" IS DISTINCT FROM NEW."customerName")
EXECUTE FUNCTION public.sync_order_customer_name();

COMMIT;