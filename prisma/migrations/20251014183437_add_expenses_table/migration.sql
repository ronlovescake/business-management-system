-- CreateTable
CREATE TABLE "expenses" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "date" VARCHAR(50) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "notes" TEXT,
    "receipt" VARCHAR(500),
    "status" VARCHAR(20) NOT NULL,
    "employeeName" VARCHAR(255),

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expenses_date_idx" ON "expenses"("date");

-- CreateIndex
CREATE INDEX "expenses_category_idx" ON "expenses"("category");

-- CreateIndex
CREATE INDEX "expenses_status_idx" ON "expenses"("status");

-- CreateIndex
CREATE INDEX "expenses_employeeName_idx" ON "expenses"("employeeName");
