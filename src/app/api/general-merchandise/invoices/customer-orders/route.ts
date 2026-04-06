export const dynamic = 'force-dynamic';

import type { CustomerOrderData } from '@/modules/clothing/operations/checkout-links/types';
import {
  calculateCustomerOrdersFromTransactions,
  type WeightCalculationResult,
} from '../_lib/weightCalculation';
import { createCustomerOrdersRoute } from '@/modules/invoices/api/invoiceRouteFactory';

const mapResultsToCustomerOrders = (
  results: WeightCalculationResult[]
): CustomerOrderData[] => {
  return results.flatMap((customerResult, resultIndex) => {
    if (!Array.isArray(customerResult.breakdown)) {
      return [];
    }

    const normalizedCustomerName = customerResult.customerName?.trim()
      ? customerResult.customerName.trim()
      : 'Unknown Customer';

    return customerResult.breakdown.map((entry, breakdownIndex) => {
      const safeQuantity = Number.isFinite(entry.quantity)
        ? entry.quantity
        : Number(entry.quantity ?? 0) || 0;
      const safeWeightPerPiece = Number.isFinite(entry.weightPerPiece)
        ? entry.weightPerPiece
        : Number(entry.weightPerPiece ?? 0) || 0;
      const safeTotalWeight = Number.isFinite(entry.totalWeight)
        ? entry.totalWeight
        : Number(entry.totalWeight ?? 0) || 0;

      const productCode = entry.productCode?.trim() || 'Unknown Product';

      return {
        id: `${normalizedCustomerName}-${productCode}-${resultIndex}-${breakdownIndex}`,
        customerName: normalizedCustomerName,
        productCode,
        quantity: safeQuantity,
        orderStatus: entry.orderStatus?.trim() || 'Unknown',
        weightPerPiece: safeWeightPerPiece.toFixed(2),
        actualWeight: safeTotalWeight.toFixed(2),
      } satisfies CustomerOrderData;
    });
  });
};

const { GET } = createCustomerOrdersRoute(
  calculateCustomerOrdersFromTransactions,
  mapResultsToCustomerOrders,
  { defaultRequireInvoiceDate: false },
  'GM'
);

export { GET };
