import { calculateProductFinancials } from '@/lib/productCalculations';
import type { ProductDTO } from './dto';

const roundToTwoDecimals = (value: number) => Number(value.toFixed(2));

export function recalculateProductFinancials(product: ProductDTO): ProductDTO {
  const calculations = calculateProductFinancials({
    unitPrice: product['Unit Price'],
    quantity: product.Quantity,
    alibabaShippingCost: product['Alibaba Shipping Cost'],
    exchangeRates: product['Exchange Rates'],
    forwardersFee: product["Forwarder's Fee"],
    lalamove: product.Lalamove,
    packagingCost: product['Packaging Cost'],
    actualPrice: product['Actual Price'],
    applyTransactionFee: product['Transaction Fee'] > 0,
    bulkWeight: product['Bulk Weight'],
    bulkQuantity: product['Bulk Quantity'],
  });

  return {
    ...product,
    PHP: roundToTwoDecimals(calculations.php),
    'Sub Total (PHP)': roundToTwoDecimals(calculations.subTotalPHP),
    'Transaction Fee': roundToTwoDecimals(calculations.transactionFee),
    'Grand Total': roundToTwoDecimals(calculations.grandTotal),
    'Suggested Price': roundToTwoDecimals(calculations.suggestedPrice),
    'Landed Unit Cost': roundToTwoDecimals(calculations.basePrice),
    COGS: roundToTwoDecimals(calculations.cogs),
    'Projected Sales': roundToTwoDecimals(calculations.projectedSales),
    'Projected Profit': roundToTwoDecimals(calculations.projectedProfit),
    'Projected Profit (%)': roundToTwoDecimals(
      calculations.projectedProfitPercent
    ),
    'Total Markup': roundToTwoDecimals(calculations.totalMarkup),
    'Weight Per Piece': roundToTwoDecimals(calculations.weightPerPiece),
  };
}
