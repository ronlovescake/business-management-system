/**
 * Product Financial Calculations Utility
 *
 * This utility provides a centralized, optimized function for all product
 * financial calculations to avoid duplicate code and improve performance.
 *
 * All calculations maintain exact business logic from the original implementation.
 */

export interface ProductCalculationInput {
  unitPrice: number;
  quantity: number;
  alibabaShippingCost: number;
  exchangeRates: number;
  forwardersFee: number;
  lalamove: number;
  packagingCost: number;
  actualPrice: number;
  bulkWeight?: number;
  bulkQuantity?: number;
}

export interface ProductCalculationResult {
  php: number;
  subTotalPHP: number;
  transactionFee: number;
  grandTotal: number;
  forwardersFee: number;
  lalamove: number;
  packagingCost: number;
  suggestedPrice: number;
  actualPrice: number;
  basePrice: number;
  cogs: number;
  projectedSales: number;
  projectedProfit: number;
  projectedProfitPercent: number;
  totalMarkup: number;
  weightPerPiece: number;
}

/**
 * Calculate all financial metrics for a product
 *
 * @param product - Product data containing prices, quantities, and costs
 * @returns Object containing all calculated financial metrics
 */
export function calculateProductFinancials(
  product: ProductCalculationInput
): ProductCalculationResult {
  // Extract values with defaults
  const unitPrice = product.unitPrice || 0;
  const quantity = product.quantity || 0;
  const alibabaShippingCost = product.alibabaShippingCost || 0;
  const exchangeRates = product.exchangeRates || 0;
  const forwardersFee = product.forwardersFee || 0;
  const lalamove = product.lalamove || 0;
  const packagingCost = product.packagingCost || 0;
  const actualPrice = product.actualPrice || 0;
  const bulkWeight = product.bulkWeight || 0;
  const bulkQuantity = product.bulkQuantity || 0;

  // Primary calculations
  const php = unitPrice * exchangeRates;
  const subTotalPHP =
    (unitPrice * quantity + alibabaShippingCost) * exchangeRates;
  const transactionFee = subTotalPHP * 0.0299;
  const grandTotal = subTotalPHP + transactionFee;

  // Cost calculations
  const cogs = grandTotal + forwardersFee + lalamove + packagingCost;
  const basePrice = quantity > 0 ? cogs / quantity : 0;

  // Price and profit calculations
  const suggestedPrice = Math.ceil(basePrice * 1.22);
  const projectedSales = actualPrice * quantity;
  const projectedProfit = projectedSales - cogs;
  const projectedProfitPercent = cogs > 0 ? (projectedProfit / cogs) * 100 : 0;
  const totalMarkup = php > 0 ? (actualPrice / php) * 100 : 0;

  // Weight calculation
  const weightPerPiece = bulkQuantity > 0 ? bulkWeight / bulkQuantity : 0;

  return {
    php,
    subTotalPHP,
    transactionFee,
    grandTotal,
    forwardersFee,
    lalamove,
    packagingCost,
    suggestedPrice,
    actualPrice,
    basePrice,
    cogs,
    projectedSales,
    projectedProfit,
    projectedProfitPercent,
    totalMarkup,
    weightPerPiece,
  };
}

/**
 * Format currency value for display
 *
 * @param value - Number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string
 */
export function formatCurrency(value: number, decimals: number = 2): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format percentage value for display
 *
 * @param value - Number to format as percentage
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string with % symbol
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}%`;
}
