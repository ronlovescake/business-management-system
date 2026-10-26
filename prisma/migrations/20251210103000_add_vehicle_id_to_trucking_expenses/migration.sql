-- Add optional vehicleId field for trucking expenses
ALTER TABLE "trucking_expenses" ADD COLUMN IF NOT EXISTS "vehicleId" VARCHAR(50);

-- Mirror Prisma schema indexes
CREATE INDEX IF NOT EXISTS "trucking_expenses_vehicleId_idx" ON "trucking_expenses"("vehicleId");
