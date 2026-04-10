-- Add missing deletedAt column to all cash advance tables
-- The Prisma schema includes this column but no migration ever created it,
-- causing "column cash_advances.deletedAt does not exist" errors on all queries.

-- Clothing cash advances (public schema)
ALTER TABLE public.cash_advances
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "cash_advances_deletedAt_idx"
ON public.cash_advances ("deletedAt");

CREATE INDEX IF NOT EXISTS "cash_advances_employeeId_status_deletedAt_idx"
ON public.cash_advances ("employeeId", "status", "deletedAt");

CREATE INDEX IF NOT EXISTS "cash_advances_status_requestDate_deletedAt_idx"
ON public.cash_advances ("status", "requestDate", "deletedAt");

-- Trucking cash advances (public schema)
ALTER TABLE public.trucking_cash_advances
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "trucking_cash_advances_deletedAt_idx"
ON public.trucking_cash_advances ("deletedAt");

CREATE INDEX IF NOT EXISTS "trucking_cash_advances_employeeId_status_deletedAt_idx"
ON public.trucking_cash_advances ("employeeId", "status", "deletedAt");

CREATE INDEX IF NOT EXISTS "trucking_cash_advances_status_requestDate_deletedAt_idx"
ON public.trucking_cash_advances ("status", "requestDate", "deletedAt");

-- General Merchandise cash advances (general_merchandise schema)
ALTER TABLE general_merchandise.cash_advances
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "gm_cash_advances_deletedAt_idx"
ON general_merchandise.cash_advances ("deletedAt");

CREATE INDEX IF NOT EXISTS "gm_cash_advances_employeeId_status_deletedAt_idx"
ON general_merchandise.cash_advances ("employeeId", "status", "deletedAt");

CREATE INDEX IF NOT EXISTS "gm_cash_advances_status_requestDate_deletedAt_idx"
ON general_merchandise.cash_advances ("status", "requestDate", "deletedAt");
