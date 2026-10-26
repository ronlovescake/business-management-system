BEGIN;

ALTER TABLE public.transactions
  ADD COLUMN "initialDepositAmount" DECIMAL(18,2),
  ADD COLUMN "initialDepositRate" DECIMAL(7,4),
  ADD COLUMN "depositConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "depositConfirmedBy" VARCHAR(255);

CREATE TABLE public.clothing_financial_requests (
  id UUID PRIMARY KEY,
  operation VARCHAR(50) NOT NULL,
  "payloadHash" VARCHAR(64) NOT NULL,
  result JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.transaction_payments
  ADD COLUMN "financialRequestId" UUID,
  ADD CONSTRAINT "transaction_payments_financialRequestId_fkey" FOREIGN KEY ("financialRequestId") REFERENCES public.clothing_financial_requests(id) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE public.clothing_order_cancellations (
  id UUID PRIMARY KEY REFERENCES public.clothing_financial_requests(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "transactionId" INTEGER NOT NULL UNIQUE REFERENCES public.transactions(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  kind VARCHAR(30) NOT NULL,
  "decisionDate" VARCHAR(10) NOT NULL,
  reason TEXT NOT NULL,
  "previousStatus" VARCHAR(100),
  "grossAmount" DECIMAL(18,2) NOT NULL,
  "collectedAmount" DECIMAL(18,2) NOT NULL,
  "priorRefundAmount" DECIMAL(18,2) NOT NULL,
  "retainedAmount" DECIMAL(18,2) NOT NULL,
  "approvedRefundAmount" DECIMAL(18,2) NOT NULL,
  "pendingAmount" DECIMAL(18,2) NOT NULL,
  "receivableCreditAmount" DECIMAL(18,2) NOT NULL,
  "initialDepositAmount" DECIMAL(18,2),
  "createdBy" VARCHAR(255) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "clothing_order_cancellations_decisionDate_idx" ON public.clothing_order_cancellations("decisionDate");
CREATE INDEX "clothing_order_cancellations_pendingAmount_createdAt_idx" ON public.clothing_order_cancellations("pendingAmount", "createdAt");

CREATE TABLE public.clothing_refund_payouts (
  id UUID PRIMARY KEY REFERENCES public.clothing_financial_requests(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "cancellationId" UUID NOT NULL REFERENCES public.clothing_order_cancellations(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "refundId" INTEGER NOT NULL UNIQUE REFERENCES public.transaction_refunds(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  amount DECIMAL(18,2) NOT NULL,
  "paymentDate" VARCHAR(10) NOT NULL,
  method VARCHAR(100) NOT NULL,
  "createdBy" VARCHAR(255) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "clothing_refund_payouts_cancellationId_paymentDate_idx" ON public.clothing_refund_payouts("cancellationId", "paymentDate");

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_initial_deposit_nonnegative CHECK ("initialDepositAmount" IS NULL OR "initialDepositAmount" >= 0),
  ADD CONSTRAINT transactions_initial_deposit_rate_valid CHECK ("initialDepositRate" IS NULL OR ("initialDepositRate" > 0 AND "initialDepositRate" <= 100));

ALTER TABLE public.clothing_order_cancellations
  ADD CONSTRAINT clothing_order_cancellations_kind_check CHECK (kind IN ('CANCELLED', 'VOIDED')),
  ADD CONSTRAINT clothing_cancellation_amounts_valid CHECK (
    "grossAmount" >= 0 AND "collectedAmount" >= 0 AND "priorRefundAmount" >= 0 AND
    "retainedAmount" >= 0 AND "approvedRefundAmount" >= 0 AND
    "pendingAmount" >= 0 AND "pendingAmount" <= "approvedRefundAmount" AND
    "receivableCreditAmount" >= 0 AND
    "retainedAmount" + "approvedRefundAmount" + "priorRefundAmount" = "collectedAmount" AND
    ("initialDepositAmount" IS NULL OR ("initialDepositAmount" >= 0 AND "retainedAmount" <= "initialDepositAmount")) AND
    (kind <> 'VOIDED' OR "retainedAmount" = 0)
  );

ALTER TABLE public.clothing_refund_payouts
  ADD CONSTRAINT clothing_refund_payouts_amount_check CHECK (amount > 0);

COMMIT;
