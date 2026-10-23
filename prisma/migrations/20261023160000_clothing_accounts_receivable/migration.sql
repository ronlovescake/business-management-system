BEGIN;

ALTER TABLE public."Customer"
  ADD COLUMN IF NOT EXISTS "creditApproved" BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS "shippedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "accountsReceivableDueAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "transactions_orderStatus_accountsReceivableDueAt_idx"
  ON public.transactions("orderStatus", "accountsReceivableDueAt");

COMMIT;