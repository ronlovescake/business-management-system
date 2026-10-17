CREATE TABLE "public"."ClothingInvestmentPayment" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "agreementId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paidDate" VARCHAR(10) NOT NULL,
    CONSTRAINT "ClothingInvestmentPayment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ClothingInvestmentPayment_month_check" CHECK ("month" BETWEEN 1 AND 36),
    CONSTRAINT "ClothingInvestmentPayment_amount_check" CHECK ("amount" > 0),
    CONSTRAINT "ClothingInvestmentPayment_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "public"."ClothingInvestmentAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ClothingInvestmentPayment_agreementId_month_key" ON "public"."ClothingInvestmentPayment"("agreementId", "month");
CREATE INDEX "ClothingInvestmentPayment_paidDate_idx" ON "public"."ClothingInvestmentPayment"("paidDate");