/**
 * Product Types
 * All TypeScript interfaces and types for the Products module
 */

import { GridCell } from '@glideapps/glide-data-grid';

/**
 * Core Product Data Structure (32 fields)
 */
export interface ProductData {
  id?: number;
  'Shipment Code': string;
  'CV Number': string;
  'No. Of Sacks': number;
  'Total CBM': number;
  Weight: number;
  'Shipment Status': string;
  'Posting Date': string;
  'Order Date': string;
  Payment: string;
  Product: string;
  'Product Code': string;
  'Age Range': string;
  Unit: string;
  'Unit Price': number;
  Quantity: number;
  'Alibaba Shipping Cost': number;
  'Exchange Rates': number;
  PHP: number;
  'Sub Total (PHP)': number;
  'Transaction Fee': number;
  'Grand Total': number;
  "Forwarder's Fee": number;
  Lalamove: number;
  'Packaging Cost': number;
  'Suggested Price': number;
  'Actual Price': number;
  'Base Price': number;
  COGS: number;
  'Projected Sales': number;
  'Projected Profit': number;
  'Projected Profit (%)': number;
  'Total Markup': number;
}

/**
 * Product Form Data (15 input fields)
 */
export interface ProductFormData {
  shipmentCode: string;
  postingDate: string;
  orderDate: string;
  payment: string;
  product: string;
  ageRange: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  alibabaShippingCost: number;
  exchangeRates: number;
  forwardersFee: number;
  lalamove: number;
  packagingCost: number;
  actualPrice: number;
}

/**
 * Product Statistics
 */
export interface ProductStatistics {
  total: number;
  totalValue: number;
  avgValue: number;
  totalProfit: number;
}

/**
 * Product with search index for filtering
 */
export interface ProductWithSearchIndex extends ProductData {
  searchIndex: string;
}

/**
 * Product Column Keys (for idToKey mapping)
 */
export type ProductColumnKey = keyof ProductData;

/**
 * Column Alignment Options
 */
export type ColumnAlignment = 'left' | 'center' | 'right';

/**
 * Grid Cell with Cursor (extends GridCell with cursor property)
 */
export type GridCellWithCursor = GridCell & {
  cursor?: string;
};

/**
 * CSV Import Result
 */
export interface CSVImportResult {
  success: boolean;
  count: number;
  products: ProductData[];
  errors?: string[];
}

/**
 * Shipment Data (for lookup integration)
 */
export interface ShipmentData {
  'Shipment Code': string;
  'CV Number': string;
  'No. Of Sacks': number;
  'Total CBM': number;
  Weight: number;
  'Shipment Status': string;
}

/**
 * Product Validation Result
 */
export interface ProductValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Product Calculation Inputs (passed to calculateProductFinancials)
 */
export interface ProductCalculationInputs {
  unitPrice: number;
  quantity: number;
  alibabaShippingCost: number;
  exchangeRates: number;
  forwardersFee: number;
  lalamove: number;
  packagingCost: number;
  actualPrice: number;
}

/**
 * Product Calculation Results (returned from calculateProductFinancials)
 */
export interface ProductCalculationResults {
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
}

/**
 * Product Filter State
 */
export interface ProductFilterState {
  searchQuery: string;
  shipmentCode?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

/**
 * Product Sort Options
 */
export type ProductSortField =
  | 'Product Code'
  | 'Product'
  | 'Posting Date'
  | 'Projected Profit'
  | 'COGS'
  | 'Quantity';

export type ProductSortDirection = 'asc' | 'desc';

export interface ProductSortState {
  field: ProductSortField;
  direction: ProductSortDirection;
}

/**
 * Constants
 */
export const TRANSACTION_FEE_RATE = 0.0299; // 2.99%
export const SUGGESTED_PRICE_MARKUP = 1.22; // 122%

/**
 * Age Range Options
 */
export const AGE_RANGE_OPTIONS = [
  { label: '👶 Baby (0-2 years)', value: 'Baby' },
  { label: '🧒 Kids (3-12 years)', value: 'Kids' },
  { label: '👦 Teen (13-17 years)', value: 'Teen' },
  { label: '👨 Adult (18-64 years)', value: 'Adult' },
  { label: '👴 Senior (65+ years)', value: 'Senior' },
  { label: '🌟 All Ages', value: 'All Ages' },
] as const;

/**
 * Unit Options
 */
export const UNIT_OPTIONS = [
  { label: '📦 Pieces', value: 'Pieces' },
  { label: '🎁 Sets', value: 'Sets' },
  { label: '👟 Pairs', value: 'Pairs' },
  { label: '📦 Packs', value: 'Packs' },
] as const;

/**
 * Payment Status Options
 */
export const PAYMENT_STATUS_OPTIONS = [
  { label: '✅ Paid', value: 'Paid' },
  { label: '⏳ Unpaid', value: 'Unpaid' },
] as const;

/**
 * Common words to skip in Product Code initials generation
 */
export const SKIP_WORDS = [
  'and',
  'the',
  'of',
  'in',
  'for',
  'with',
  'on',
  'at',
  'to',
  'a',
  'an',
  '&',
] as const;

/**
 * Special cases for Product Code generation
 */
export const PRODUCT_CODE_SPECIAL_CASES: Record<string, string> = {
  '2-PC': '2S',
  '3-PC': '3S',
  '4-PC': '4S',
} as const;

/**
 * Columns that should display with 2 decimal places
 */
export const TWO_DECIMAL_COLUMNS = [
  'unitPrice',
  'alibabaShippingCost',
  'exchangeRates',
  'php',
  'subTotalPHP',
  'transactionFee',
  'grandTotal',
  'forwardersFee',
  'lalamove',
  'packagingCost',
  'suggestedPrice',
  'actualPrice',
  'basePrice',
  'cogs',
  'projectedSales',
  'projectedProfit',
  'projectedProfitPercent',
  'totalMarkup',
] as const;

/**
 * Center-aligned columns
 */
export const CENTER_ALIGN_COLUMNS = [
  'shipmentCode',
  'cvNumber',
  'noOfSacks',
  'totalCBM',
  'weight',
  'shipmentStatus',
  'postingDate',
  'orderDate',
  'payment',
] as const;

/**
 * Left-aligned columns
 */
export const LEFT_ALIGN_COLUMNS = [
  'product',
  'productCode',
  'ageRange',
  'unit',
  'quantity',
] as const;

/**
 * Right-aligned columns (financial data)
 */
export const RIGHT_ALIGN_COLUMNS = [
  'unitPrice',
  'alibabaShippingCost',
  'exchangeRates',
  'php',
  'subTotalPHP',
  'transactionFee',
  'grandTotal',
  'forwardersFee',
  'lalamove',
  'packagingCost',
  'suggestedPrice',
  'actualPrice',
  'basePrice',
  'cogs',
  'projectedSales',
  'projectedProfit',
  'projectedProfitPercent',
  'totalMarkup',
] as const;
