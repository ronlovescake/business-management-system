DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.tables
		WHERE table_schema = 'public'
			AND table_name = 'trucking_expenses'
	) THEN
		-- Add optional vehicleId field for trucking expenses
		ALTER TABLE "trucking_expenses" ADD COLUMN IF NOT EXISTS "vehicleId" VARCHAR(50);

		-- Mirror Prisma schema indexes
		CREATE INDEX IF NOT EXISTS "trucking_expenses_vehicleId_idx"
			ON "trucking_expenses"("vehicleId");
	ELSE
		RAISE NOTICE 'Skipping vehicleId migration because trucking_expenses table does not exist.';
	END IF;
END;
$$;
