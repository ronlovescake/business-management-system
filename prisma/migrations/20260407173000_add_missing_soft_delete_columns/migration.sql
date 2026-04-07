ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS expenses_deletedat_idx
ON public.expenses ("deletedAt");

ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS leave_requests_deletedat_idx
ON public.leave_requests ("deletedAt");

ALTER TABLE general_merchandise.expenses
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS gm_expenses_deletedat_idx
ON general_merchandise.expenses ("deletedAt");

ALTER TABLE general_merchandise.leave_requests
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS gm_leave_requests_deletedat_idx
ON general_merchandise.leave_requests ("deletedAt");ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS expenses_deletedat_idx
ON public.expenses ("deletedAt");

ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS leave_requests_deletedat_idx
ON public.leave_requests ("deletedAt");

ALTER TABLE general_merchandise.expenses
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS gm_expenses_deletedat_idx
ON general_merchandise.expenses ("deletedAt");

ALTER TABLE general_merchandise.leave_requests
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS gm_leave_requests_deletedat_idx
ON general_merchandise.leave_requests ("deletedAt");