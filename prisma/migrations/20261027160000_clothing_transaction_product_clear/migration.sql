BEGIN;

CREATE OR REPLACE FUNCTION public.resolve_clothing_product_identity() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  code_column text := TG_ARGV[0];
  incoming_code text := to_jsonb(NEW)->>TG_ARGV[0];
  previous_code text;
  current_code text;
  match_count bigint;
  matched_id integer;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    previous_code := to_jsonb(OLD)->>code_column;
  END IF;

  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'transactions'
    AND nullif(btrim(incoming_code), '') IS NULL THEN
    NEW."productId" := NULL;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'inventory_movements' AND NEW."productId" IS NULL THEN
    SELECT "productId" INTO matched_id FROM public.transactions
    WHERE id = (to_jsonb(NEW)->>'sourceTransactionId')::integer
      AND lower(btrim("productCode")) = lower(btrim(incoming_code));
    NEW."productId" := matched_id;
  END IF;

  IF NEW."productId" IS NOT NULL THEN
    SELECT "productCode" INTO current_code FROM public.products WHERE id = NEW."productId";
    IF current_code IS NULL AND NOT FOUND THEN
      RAISE EXCEPTION 'Product ID % does not exist', NEW."productId" USING ERRCODE = '23503';
    END IF;
    IF (TG_OP = 'INSERT' OR NEW."productId" IS DISTINCT FROM OLD."productId")
      AND incoming_code IS DISTINCT FROM current_code THEN
      RAISE EXCEPTION 'Product ID and code do not match' USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'INSERT' OR incoming_code IS NOT DISTINCT FROM previous_code
      OR incoming_code IS NOT DISTINCT FROM current_code THEN
      IF current_code IS NOT NULL THEN
        NEW := jsonb_populate_record(NEW, jsonb_build_object(code_column, current_code));
      END IF;
      RETURN NEW;
    END IF;
  END IF;

  SELECT COUNT(*), MIN(id) INTO match_count, matched_id
  FROM public.products
  WHERE "deletedAt" IS NULL AND lower(btrim("productCode")) = lower(btrim(incoming_code));

  IF match_count = 1 THEN
    NEW."productId" := matched_id;
    SELECT "productCode" INTO current_code FROM public.products WHERE id = matched_id;
    NEW := jsonb_populate_record(NEW, jsonb_build_object(code_column, current_code));
  ELSE
    IF TG_OP = 'UPDATE' AND OLD."productId" IS NOT NULL THEN
      RAISE EXCEPTION 'Product code is missing or ambiguous; choose a unique product' USING ERRCODE = '23514';
    END IF;
    NEW."productId" := NULL;
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
