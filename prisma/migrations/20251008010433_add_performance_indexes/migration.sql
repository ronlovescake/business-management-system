-- CreateTable
CREATE TABLE "HealthCheck" (
    "id" SERIAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ok',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "date" VARCHAR(50) NOT NULL,
    "customerName" VARCHAR(255) NOT NULL,
    "phoneNumber" VARCHAR(100) NOT NULL,
    "address" VARCHAR(500) NOT NULL,
    "facebook" VARCHAR(255) NOT NULL,
    "emailAddress" VARCHAR(255) NOT NULL,
    "businessName" VARCHAR(255) NOT NULL,
    "taxNumber" VARCHAR(100) NOT NULL,
    "businessAddress" VARCHAR(500) NOT NULL,
    "businessContactNumber" VARCHAR(100) NOT NULL,
    "customerStatus" VARCHAR(50) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prices" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "productCode" VARCHAR(100) NOT NULL,
    "lowerLimit" INTEGER NOT NULL,
    "upperLimit" INTEGER NOT NULL,
    "currentPrice" INTEGER NOT NULL,
    "priceAdjustment" INTEGER NOT NULL DEFAULT 0,
    "description" VARCHAR(500),
    "category" VARCHAR(100),
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "shipmentCode" VARCHAR(100),
    "cvNumber" VARCHAR(100),
    "noOfSacks" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCBM" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shipmentStatus" VARCHAR(100),
    "postingDate" VARCHAR(50),
    "orderDate" VARCHAR(50),
    "payment" VARCHAR(100),
    "product" VARCHAR(500),
    "productCode" VARCHAR(100),
    "ageRange" VARCHAR(100),
    "unit" VARCHAR(50),
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "alibabaShippingCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "exchangeRates" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "php" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subTotalPHP" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "transactionFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grandTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "forwardersFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lalamove" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "packagingCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "suggestedPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "basePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cogs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "projectedSales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "projectedProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "projectedProfitPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalMarkup" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "shipmentCode" VARCHAR(100) NOT NULL,
    "cvNumber" VARCHAR(100),
    "noOfSacks" INTEGER NOT NULL DEFAULT 0,
    "totalCBM" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shipmentStatus" VARCHAR(100) NOT NULL,
    "dateCreated" VARCHAR(50),
    "dateDelivered" VARCHAR(50),
    "duration" VARCHAR(20),
    "notes" TEXT,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orderDate" VARCHAR(50),
    "customers" VARCHAR(255),
    "productCode" VARCHAR(100),
    "quantity" DOUBLE PRECISION,
    "unitPrice" DOUBLE PRECISION,
    "discount" DOUBLE PRECISION,
    "adjustment" DOUBLE PRECISION,
    "lineTotal" DOUBLE PRECISION,
    "orderStatus" VARCHAR(100),
    "notes" TEXT,
    "invoiceDate" VARCHAR(50),
    "packedDate" VARCHAR(50),
    "shipmentCode" VARCHAR(100),

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sorting_distributions" (
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

    CONSTRAINT "sorting_distributions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_customerName_idx" ON "Customer"("customerName");

-- CreateIndex
CREATE INDEX "Customer_phoneNumber_idx" ON "Customer"("phoneNumber");

-- CreateIndex
CREATE INDEX "Customer_customerStatus_idx" ON "Customer"("customerStatus");

-- CreateIndex
CREATE INDEX "prices_productCode_idx" ON "prices"("productCode");

-- CreateIndex
CREATE INDEX "prices_productCode_lowerLimit_upperLimit_idx" ON "prices"("productCode", "lowerLimit", "upperLimit");

-- CreateIndex
CREATE INDEX "prices_isActive_idx" ON "prices"("isActive");

-- CreateIndex
CREATE INDEX "products_productCode_idx" ON "products"("productCode");

-- CreateIndex
CREATE INDEX "products_shipmentCode_idx" ON "products"("shipmentCode");

-- CreateIndex
CREATE INDEX "products_shipmentStatus_idx" ON "products"("shipmentStatus");

-- CreateIndex
CREATE INDEX "shipments_shipmentCode_idx" ON "shipments"("shipmentCode");

-- CreateIndex
CREATE INDEX "shipments_shipmentStatus_idx" ON "shipments"("shipmentStatus");

-- CreateIndex
CREATE INDEX "transactions_orderDate_idx" ON "transactions"("orderDate");

-- CreateIndex
CREATE INDEX "transactions_customers_idx" ON "transactions"("customers");

-- CreateIndex
CREATE INDEX "transactions_productCode_idx" ON "transactions"("productCode");

-- CreateIndex
CREATE INDEX "transactions_orderStatus_idx" ON "transactions"("orderStatus");

-- CreateIndex
CREATE INDEX "transactions_shipmentCode_idx" ON "transactions"("shipmentCode");

-- CreateIndex
CREATE INDEX "sorting_distributions_productCode_idx" ON "sorting_distributions"("productCode");

-- CreateIndex
CREATE INDEX "sorting_distributions_groupNumber_idx" ON "sorting_distributions"("groupNumber");

-- CreateIndex
CREATE UNIQUE INDEX "sorting_distributions_productCode_rowNumber_key" ON "sorting_distributions"("productCode", "rowNumber");
