-- Add missing columns for transactions settings and products
ALTER TABLE "transactions_settings" ADD COLUMN IF NOT EXISTS "minSpareRows" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "linkToPost" VARCHAR(1000);
