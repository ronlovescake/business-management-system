-- Add split batch tables for break-pack/split products
-- Additive only; safe to deploy to existing databases.

CREATE TABLE IF NOT EXISTS public.split_batches (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postingDate" VARCHAR(50) NOT NULL,
    "splitName" VARCHAR(255) NOT NULL,
    "splitSku" VARCHAR(255) NOT NULL,

    CONSTRAINT "split_batches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "split_batches_splitSku_key"
ON public.split_batches ("splitSku");

CREATE INDEX IF NOT EXISTS "split_batches_splitSku_idx"
ON public.split_batches ("splitSku");

CREATE INDEX IF NOT EXISTS "split_batches_postingDate_idx"
ON public.split_batches ("postingDate");

CREATE TABLE IF NOT EXISTS public.split_batch_components (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "splitBatchId" INTEGER NOT NULL,
    "componentLabel" VARCHAR(255) NOT NULL,
    "componentSku" VARCHAR(100) NOT NULL,
    "includedQuantity" DOUBLE PRECISION NOT NULL DEFAULT 1,

    CONSTRAINT "split_batch_components_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "split_batch_components_splitBatchId_idx"
ON public.split_batch_components ("splitBatchId");

CREATE INDEX IF NOT EXISTS "split_batch_components_componentSku_idx"
ON public.split_batch_components ("componentSku");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'split_batch_components_splitBatchId_fkey'
    ) THEN
        ALTER TABLE public.split_batch_components
        ADD CONSTRAINT "split_batch_components_splitBatchId_fkey"
        FOREIGN KEY ("splitBatchId")
        REFERENCES public.split_batches ("id")
        ON DELETE CASCADE
        ON UPDATE NO ACTION;
    END IF;
END $$;