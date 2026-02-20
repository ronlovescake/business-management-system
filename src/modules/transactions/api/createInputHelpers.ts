import type { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import type { TransactionRecord } from './sanitizers';

export interface PriceTier {
  productCode: string | null;
  lowerLimit: number;
  upperLimit: number;
  currentPrice: number;
}

function getUnitPriceForQuantity(
  productCode: string,
  quantity: number,
  priceTiers: PriceTier[]
): number {
  if (!productCode || !quantity || quantity <= 0) {
    return 0;
  }

  const matchingTier = priceTiers.find((tier) => {
    if (!tier.productCode) {
      return false;
    }
    if (tier.productCode !== productCode) {
      return false;
    }
    const lowerLimit = tier.lowerLimit / 100;
    const upperLimit = tier.upperLimit / 100;
    return quantity >= lowerLimit && quantity <= upperLimit;
  });

  return matchingTier ? matchingTier.currentPrice : 0;
}

function calculateLineTotal(
  quantity: number,
  unitPrice: number,
  adjustment: number
): number {
  return quantity * unitPrice - adjustment;
}

export function buildCreateInput(
  row: TransactionRecord,
  priceTiers: PriceTier[]
): Prisma.TransactionCreateManyInput {
  const quantity = row.Quantity;
  const discount = row.Discount;
  const adjustment = row.Adjustment;
  const productCode = row['Product Code'];

  let unitPrice = row['Unit Price'];
  if (unitPrice === 0 && quantity > 0 && productCode) {
    const tierPrice = getUnitPriceForQuantity(
      productCode,
      quantity,
      priceTiers
    );
    if (tierPrice > 0) {
      const tierPriceInPeso = tierPrice / 100;
      unitPrice = tierPriceInPeso - discount;
      logger.debug(
        `Auto-calculated Unit Price for ${productCode} (Qty: ${quantity}): ${tierPriceInPeso} - ${discount} = ${unitPrice}`
      );
    }
  }

  let lineTotal = row['Line Total'];
  if (lineTotal === 0) {
    lineTotal = calculateLineTotal(quantity, unitPrice, adjustment);
    logger.debug(
      `Auto-calculated Line Total: (${quantity} × ${unitPrice}) - ${adjustment} = ${lineTotal}`
    );
  }

  return {
    orderDate: row['Order Date'],
    customers: row.Customers,
    productCode,
    quantity,
    unitPrice,
    discount,
    adjustment,
    lineTotal,
    orderStatus: row['Order Status'] || null,
    notes: row.Notes,
    invoiceDate: row['Invoice Date'],
    packedDate: row['Packed Date'],
    shipmentCode: row['Shipment Code'],
  } satisfies Prisma.TransactionCreateManyInput;
}
