BEGIN;

ALTER TABLE public.products
  ADD COLUMN "supplierReference" VARCHAR(200),
  ADD COLUMN "supplierFulfillmentStatus" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "supplierCreditAppliedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;

ALTER TABLE public.products ADD CONSTRAINT products_supplier_credit_funding_check
  CHECK ("supplierCreditAppliedAmount" >= 0 AND "supplierFulfillmentStatus" IN ('ACTIVE', 'CREDIT_ISSUED'));

CREATE TABLE public.clothing_supplier_credits (
  id TEXT PRIMARY KEY,
  "sourceProductId" INTEGER NOT NULL UNIQUE REFERENCES public.products(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "supplierReference" VARCHAR(200) NOT NULL,
  reference VARCHAR(150) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'PHP',
  amount DECIMAL(18,2) NOT NULL,
  "availableAmount" DECIMAL(18,2) NOT NULL,
  quantity DOUBLE PRECISION NOT NULL,
  "sourceShipmentCode" VARCHAR(100),
  "postingDate" TIMESTAMPTZ(6) NOT NULL,
  "requestId" VARCHAR(100) NOT NULL UNIQUE,
  "createdBy" VARCHAR(100) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT clothing_supplier_credit_balance_check CHECK (amount > 0 AND "availableAmount" >= 0 AND "availableAmount" <= amount AND quantity > 0 AND currency = 'PHP')
);

CREATE INDEX clothing_supplier_credits_supplier_currency_idx ON public.clothing_supplier_credits("supplierReference", currency);

CREATE TABLE public.clothing_supplier_credit_applications (
  id TEXT PRIMARY KEY,
  "creditId" TEXT NOT NULL REFERENCES public.clothing_supplier_credits(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "targetProductId" INTEGER NOT NULL UNIQUE REFERENCES public.products(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  amount DECIMAL(18,2) NOT NULL CHECK (amount > 0),
  "postingDate" TIMESTAMPTZ(6) NOT NULL,
  "requestId" VARCHAR(100) NOT NULL UNIQUE,
  "createdBy" VARCHAR(100) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX clothing_supplier_credit_applications_credit_idx ON public.clothing_supplier_credit_applications("creditId");

CREATE TABLE public.clothing_product_shipment_transfers (
  id TEXT PRIMARY KEY,
  "productId" INTEGER NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  "fromShipmentCode" VARCHAR(100) NOT NULL,
  "toShipmentCode" VARCHAR(100) NOT NULL,
  reason VARCHAR(1000) NOT NULL,
  "requestId" VARCHAR(100) NOT NULL UNIQUE,
  "createdBy" VARCHAR(100) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX clothing_product_shipment_transfers_product_idx ON public.clothing_product_shipment_transfers("productId");

COMMIT;