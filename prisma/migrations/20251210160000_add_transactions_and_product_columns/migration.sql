DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.tables
		WHERE table_schema = 'public'
			AND table_name = 'transactions_settings'
	) THEN
		ALTER TABLE "transactions_settings"
			ADD COLUMN IF NOT EXISTS "minSpareRows" INTEGER NOT NULL DEFAULT 50;
	ELSE
		RAISE NOTICE 'Skipping transactions_settings migration because table does not exist.';
	END IF;

	IF EXISTS (
		SELECT 1
		FROM information_schema.tables
		WHERE table_schema = 'public'
			AND table_name = 'products'
	) THEN
		ALTER TABLE "products"
			ADD COLUMN IF NOT EXISTS "linkToPost" VARCHAR(1000);
	END IF;
END;
$$;
