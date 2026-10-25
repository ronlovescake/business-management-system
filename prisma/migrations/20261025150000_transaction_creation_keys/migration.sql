ALTER TABLE "public"."transactions" ADD COLUMN "creationKey" UUID;
CREATE UNIQUE INDEX "transactions_creationKey_key" ON "public"."transactions"("creationKey");
ALTER TABLE "general_merchandise"."transactions" ADD COLUMN "creationKey" UUID;
CREATE UNIQUE INDEX "transactions_creationKey_key" ON "general_merchandise"."transactions"("creationKey");