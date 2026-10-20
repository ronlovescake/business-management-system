BEGIN;

CREATE TABLE general_merchandise.product_code_aliases (
  id SERIAL PRIMARY KEY,
  "productId" INTEGER NOT NULL REFERENCES general_merchandise.products(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  code VARCHAR(100) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX product_code_aliases_productId_code_key
  ON general_merchandise.product_code_aliases("productId", code);
CREATE INDEX product_code_aliases_code_idx
  ON general_merchandise.product_code_aliases(code);

ALTER TABLE general_merchandise.prices ADD COLUMN "productId" INTEGER;
CREATE INDEX prices_productId_idx ON general_merchandise.prices("productId");
ALTER TABLE general_merchandise.prices
  ADD CONSTRAINT prices_productId_fkey
  FOREIGN KEY ("productId") REFERENCES general_merchandise.products(id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE general_merchandise.transactions ADD COLUMN "productId" INTEGER;
CREATE INDEX transactions_productId_idx ON general_merchandise.transactions("productId");
ALTER TABLE general_merchandise.transactions
  ADD CONSTRAINT transactions_productId_fkey
  FOREIGN KEY ("productId") REFERENCES general_merchandise.products(id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE general_merchandise.inventory_movements ADD COLUMN "productId" INTEGER;
CREATE INDEX inventory_movements_productId_idx
  ON general_merchandise.inventory_movements("productId");
ALTER TABLE general_merchandise.inventory_movements
  ADD CONSTRAINT inventory_movements_productId_fkey
  FOREIGN KEY ("productId") REFERENCES general_merchandise.products(id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE general_merchandise.sorting_distributions ADD COLUMN "productId" INTEGER;
CREATE INDEX sorting_distributions_productId_idx
  ON general_merchandise.sorting_distributions("productId");
ALTER TABLE general_merchandise.sorting_distributions
  ADD CONSTRAINT sorting_distributions_productId_fkey
  FOREIGN KEY ("productId") REFERENCES general_merchandise.products(id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE general_merchandise.bundle_batch_components ADD COLUMN "productId" INTEGER;
CREATE INDEX bundle_batch_components_productId_idx
  ON general_merchandise.bundle_batch_components("productId");
ALTER TABLE general_merchandise.bundle_batch_components
  ADD CONSTRAINT bundle_batch_components_productId_fkey
  FOREIGN KEY ("productId") REFERENCES general_merchandise.products(id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE general_merchandise.inventory_reclass_entries ADD COLUMN "productId" INTEGER;
CREATE INDEX inventory_reclass_entries_productId_idx
  ON general_merchandise.inventory_reclass_entries("productId");
ALTER TABLE general_merchandise.inventory_reclass_entries
  ADD CONSTRAINT inventory_reclass_entries_productId_fkey
  FOREIGN KEY ("productId") REFERENCES general_merchandise.products(id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

DO $$
DECLARE
  target record;
BEGIN
  FOR target IN SELECT * FROM (VALUES
    ('prices', 'productCode'),
    ('transactions', 'productCode'),
    ('sorting_distributions', 'productCode'),
    ('bundle_batch_components', 'componentProductCode'),
    ('inventory_reclass_entries', 'productCode')
  ) AS targets(table_name, code_column) LOOP
    EXECUTE format($sql$
      UPDATE general_merchandise.%I AS record SET "productId" = matched.id
      FROM (
        SELECT lower(btrim("productCode")) AS code, MIN(id) AS id
        FROM general_merchandise.products
        WHERE "deletedAt" IS NULL
          AND nullif(btrim("productCode"), '') IS NOT NULL
        GROUP BY lower(btrim("productCode")) HAVING COUNT(*) = 1
      ) AS matched
      WHERE record."productId" IS NULL
        AND lower(btrim(record.%I)) = matched.code
    $sql$, target.table_name, target.code_column);
  END LOOP;
END;
$$;

UPDATE general_merchandise.inventory_movements AS movement
SET "productId" = transaction."productId"
FROM general_merchandise.transactions AS transaction
WHERE movement."sourceTransactionId" = transaction.id
  AND transaction."productId" IS NOT NULL
  AND lower(btrim(movement."productCode")) = lower(btrim(transaction."productCode"));

UPDATE general_merchandise.inventory_movements AS movement
SET "productId" = matched.id
FROM (
  SELECT lower(btrim("productCode")) AS code, MIN(id) AS id
  FROM general_merchandise.products
  WHERE "deletedAt" IS NULL
    AND nullif(btrim("productCode"), '') IS NOT NULL
  GROUP BY lower(btrim("productCode")) HAVING COUNT(*) = 1
) AS matched
WHERE movement."productId" IS NULL
  AND lower(btrim(movement."productCode")) = matched.code;

CREATE FUNCTION general_merchandise.resolve_product_identity() RETURNS trigger
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

  IF TG_TABLE_NAME = 'inventory_movements' AND NEW."productId" IS NULL THEN
    SELECT "productId" INTO matched_id
    FROM general_merchandise.transactions
    WHERE id = (to_jsonb(NEW)->>'sourceTransactionId')::integer
      AND lower(btrim("productCode")) = lower(btrim(incoming_code));
    NEW."productId" := matched_id;
  END IF;

  IF NEW."productId" IS NOT NULL THEN
    SELECT "productCode" INTO current_code
    FROM general_merchandise.products WHERE id = NEW."productId";
    IF NOT FOUND THEN
      RAISE EXCEPTION 'GM product ID % does not exist', NEW."productId"
        USING ERRCODE = '23503';
    END IF;
    IF (TG_OP = 'INSERT' OR NEW."productId" IS DISTINCT FROM OLD."productId")
      AND incoming_code IS DISTINCT FROM current_code THEN
      RAISE EXCEPTION 'GM product ID and code do not match'
        USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'INSERT'
      OR incoming_code IS NOT DISTINCT FROM previous_code
      OR incoming_code IS NOT DISTINCT FROM current_code THEN
      IF current_code IS NOT NULL THEN
        NEW := jsonb_populate_record(
          NEW, jsonb_build_object(code_column, current_code)
        );
      END IF;
      RETURN NEW;
    END IF;
  END IF;

  SELECT COUNT(*), MIN(id) INTO match_count, matched_id
  FROM general_merchandise.products
  WHERE "deletedAt" IS NULL
    AND lower(btrim("productCode")) = lower(btrim(incoming_code));

  IF match_count > 1 THEN
    RAISE EXCEPTION 'GM product code is ambiguous; use the product ID'
      USING ERRCODE = '23514';
  ELSIF match_count = 1 THEN
    NEW."productId" := matched_id;
    SELECT "productCode" INTO current_code
    FROM general_merchandise.products WHERE id = matched_id;
    NEW := jsonb_populate_record(
      NEW, jsonb_build_object(code_column, current_code)
    );
  ELSE
    IF TG_OP = 'UPDATE' AND OLD."productId" IS NOT NULL THEN
      RAISE EXCEPTION 'GM product code is missing or ambiguous; choose a unique product'
        USING ERRCODE = '23514';
    END IF;
    NEW."productId" := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  target record;
BEGIN
  FOR target IN SELECT * FROM (VALUES
    ('prices', 'productCode'),
    ('transactions', 'productCode'),
    ('inventory_movements', 'productCode'),
    ('sorting_distributions', 'productCode'),
    ('bundle_batch_components', 'componentProductCode'),
    ('inventory_reclass_entries', 'productCode')
  ) AS targets(table_name, code_column) LOOP
    EXECUTE format(
      'CREATE TRIGGER resolve_gm_product_identity BEFORE INSERT OR UPDATE OF %I, "productId" ON general_merchandise.%I FOR EACH ROW EXECUTE FUNCTION general_merchandise.resolve_product_identity(%L)',
      target.code_column, target.table_name, target.code_column
    );
  END LOOP;
END;
$$;

CREATE FUNCTION general_merchandise.sync_product_details() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  target record;
BEGIN
  IF NEW."productCode" IS DISTINCT FROM OLD."productCode" THEN
    IF nullif(btrim(NEW."productCode"), '') IS NULL THEN
      RAISE EXCEPTION 'Cannot clear an established GM product code'
        USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      SELECT 1 FROM general_merchandise.products
      WHERE id <> NEW.id AND "deletedAt" IS NULL
        AND lower(btrim("productCode")) = lower(btrim(NEW."productCode"))
    ) THEN
      RAISE EXCEPTION 'GM product code already belongs to another product'
        USING ERRCODE = '23505';
    END IF;
    IF nullif(btrim(OLD."productCode"), '') IS NOT NULL THEN
      INSERT INTO general_merchandise.product_code_aliases ("productId", code)
      VALUES (NEW.id, OLD."productCode")
      ON CONFLICT ("productId", code) DO NOTHING;
    END IF;

    FOR target IN SELECT * FROM (VALUES
      ('prices', 'productCode'),
      ('transactions', 'productCode'),
      ('inventory_movements', 'productCode'),
      ('sorting_distributions', 'productCode'),
      ('bundle_batch_components', 'componentProductCode'),
      ('inventory_reclass_entries', 'productCode')
    ) AS targets(table_name, code_column) LOOP
      EXECUTE format(
        'UPDATE general_merchandise.%I SET %I = $1 WHERE "productId" = $2 AND %I IS DISTINCT FROM $1',
        target.table_name, target.code_column, target.code_column
      ) USING NEW."productCode", NEW.id;
    END LOOP;
  END IF;

  IF NEW."shipmentCode" IS DISTINCT FROM OLD."shipmentCode" THEN
    UPDATE general_merchandise.transactions
    SET "shipmentCode" = NEW."shipmentCode"
    WHERE "productId" = NEW.id
      AND "shipmentCode" IS DISTINCT FROM NEW."shipmentCode";
  END IF;

  IF NEW."actualPrice" IS DISTINCT FROM OLD."actualPrice" THEN
    UPDATE general_merchandise.prices AS price
    SET "currentPrice" = round(NEW."actualPrice" * 100)::integer
      + (ranks.tier_count - ranks.tier_rank) * 500
    FROM (
      SELECT id,
        row_number() OVER (ORDER BY "lowerLimit", id) AS tier_rank,
        count(*) OVER () AS tier_count
      FROM general_merchandise.prices
      WHERE "productId" = NEW.id AND "deletedAt" IS NULL
    ) AS ranks
    WHERE price.id = ranks.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_gm_product_details
AFTER UPDATE OF "productCode", "shipmentCode", "actualPrice"
ON general_merchandise.products
FOR EACH ROW EXECUTE FUNCTION general_merchandise.sync_product_details();

COMMIT;