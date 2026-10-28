import type { Prisma } from '@prisma/client';
import { FinancialOperationError } from '@/lib/accounting/financial-transactions';
import { isKnownZeroAcquisitionCost } from '@/lib/accounting/inventoryCogsShared';
import { toISODate } from '@/utils/date';

export type OriginalSaleAllocation = {
  id: number;
  productCode: string;
  quantity: number;
  unitCost: number | null;
  costBasis: string | null;
  postingDate: string | null;
  createdAt: Date;
};
type OriginalReturn = {
  sourceMovementId: number | null;
  productCode: string;
  quantity: number;
};

export function remainingOriginalSaleAllocations(
  sales: OriginalSaleAllocation[],
  returns: OriginalReturn[]
) {
  const remaining = sales.map((sale) => ({ ...sale }));
  for (const returned of returns) {
    let quantity = returned.quantity;
    for (const sale of remaining.filter((item) =>
      returned.sourceMovementId
        ? item.id === returned.sourceMovementId
        : item.productCode.toLowerCase() === returned.productCode.toLowerCase()
    )) {
      const applied = Math.min(sale.quantity, quantity);
      sale.quantity -= applied;
      quantity -= applied;
      if (quantity <= 0.000001) {
        break;
      }
    }
  }
  return remaining.filter((sale) => sale.quantity > 0.000001);
}

export function allocateOriginalPhysicalReturn(
  sales: OriginalSaleAllocation[],
  returns: OriginalReturn[],
  input: { productCode?: string; quantity: number; date: string }
) {
  const remaining = remainingOriginalSaleAllocations(sales, returns);
  const codes = Array.from(
    new Set(remaining.map((sale) => sale.productCode.toLowerCase()))
  );
  if (!input.productCode && codes.length > 1) {
    throw new FinancialOperationError(
      'Select the actual fulfilled component being returned.',
      400
    );
  }
  const code = input.productCode?.trim().toLowerCase() || codes[0];
  const candidates = remaining.filter(
    (sale) => sale.productCode.toLowerCase() === code
  );
  let quantity = input.quantity;
  const result: OriginalSaleAllocation[] = [];
  for (const sale of candidates) {
    if (
      sale.unitCost === null ||
      !Number.isFinite(sale.unitCost) ||
      sale.unitCost < 0 ||
      (sale.unitCost === 0 && !isKnownZeroAcquisitionCost(sale))
    ) {
      throw new FinancialOperationError(
        'A recorded sale with known quantity and cost is required for a separate physical return. Review the sale history.',
        400
      );
    }
    const saleDate = toISODate(sale.postingDate ?? sale.createdAt);
    if (!saleDate || input.date < saleDate) {
      throw new FinancialOperationError(
        'Physical-return date cannot precede the recorded sale.',
        400
      );
    }
    const taken = Math.min(sale.quantity, quantity);
    if (taken > 0) {
      result.push({ ...sale, quantity: taken });
    }
    quantity -= taken;
    if (quantity <= 0.000001) {
      return result;
    }
  }
  throw new FinancialOperationError(
    'Physical return exceeds the recorded sold quantity for the selected component.',
    400
  );
}

export async function loadOriginalPhysicalReturnEvidence(
  client: Prisma.TransactionClient,
  transactionId: number
) {
  const [sales, returns] = await Promise.all([
    client.inventoryMovement.findMany({
      where: {
        deletedAt: null,
        sourceTransactionId: transactionId,
        movementSource: 'transaction',
        movementType: 'sale',
        toBucket: 'sold',
      },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        productCode: true,
        quantity: true,
        unitCost: true,
        costBasis: true,
        postingDate: true,
        createdAt: true,
      },
    }),
    client.inventoryMovement.findMany({
      where: {
        deletedAt: null,
        sourceTransactionId: transactionId,
        movementType: 'return',
        fromBucket: 'sold',
      },
      orderBy: { id: 'asc' },
      select: { sourceMovementId: true, productCode: true, quantity: true },
    }),
  ]);
  return { sales, returns };
}
