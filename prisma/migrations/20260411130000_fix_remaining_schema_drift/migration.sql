-- Fix remaining Prisma schema vs production DB drift
-- Found via repo-wide scan comparing schema.prisma against production columns

-- ============================================================================
-- 1. Missing deletedAt columns (same pattern as cash advance fix)
-- ============================================================================

-- Trucking leave requests
ALTER TABLE public.trucking_leave_requests
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "trucking_leave_requests_deletedAt_idx"
ON public.trucking_leave_requests ("deletedAt");

-- Trucking expenses
ALTER TABLE public.trucking_expenses
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "trucking_expenses_deletedAt_idx"
ON public.trucking_expenses ("deletedAt");

-- ============================================================================
-- 2. Missing tables in general_merchandise schema
-- ============================================================================

-- GM sorting distributions (mirrors public.sorting_distributions)
CREATE TABLE IF NOT EXISTS general_merchandise.sorting_distributions (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "productCode" VARCHAR(100) NOT NULL,
    "selectedQuantity" INTEGER,
    "rowNumber" INTEGER NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "groupNumber" VARCHAR(50) NOT NULL DEFAULT '',
    "distribution" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "gm_sorting_distributions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "gm_sorting_distributions_productCode_rowNumber_key"
ON general_merchandise.sorting_distributions ("productCode", "rowNumber");

CREATE INDEX IF NOT EXISTS "gm_sorting_distributions_productCode_idx"
ON general_merchandise.sorting_distributions ("productCode");

CREATE INDEX IF NOT EXISTS "gm_sorting_distributions_groupNumber_idx"
ON general_merchandise.sorting_distributions ("groupNumber");

-- GM shipping fee calculator states (mirrors public.shipping_fee_calculator_states)
CREATE TABLE IF NOT EXISTS general_merchandise.shipping_fee_calculator_states (
    "id" SERIAL NOT NULL,
    "shipmentCode" VARCHAR(100) NOT NULL,
    "actualAlibabaShipping" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualForwardersFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualLalamove" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "multipliers" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "gm_shipping_fee_calculator_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "gm_shipping_fee_calculator_states_shipmentCode_key"
ON general_merchandise.shipping_fee_calculator_states ("shipmentCode");
