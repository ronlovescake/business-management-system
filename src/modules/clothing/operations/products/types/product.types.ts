/**
 * Product Types
 * All TypeScript interfaces and types for the Products module
 */

import type { GridCell } from '@glideapps/glide-data-grid';

/**
 * Core Product Data Structure (36 fields)
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
  'Payment Method'?: string | null;
  'Payment Card Id'?: string | null;
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
  'Landed Unit Cost': number;
  COGS: number;
  'Projected Sales': number;
  'Projected Profit': number;
  'Projected Profit (%)': number;
  'Total Markup': number;
  'Link To Post'?: string;
  'Bulk Quantity'?: number;
  'Bulk Weight'?: number;
  'Weight Per Piece'?: number;
  createdAt?: string;
}

/**
 * Product Form Data (15 input fields)
 */
export interface ProductFormData {
  shipmentCode: string;
  postingDate: string;
  orderDate: string;
  payment: string;
  paymentMethod: string;
  paymentCardId: string;
  product: string;
  previousProductCode: string;
  ageRange: string;
  ageRangeStart: string; // New field for start number
  ageRangeEnd: string; // New field for end number
  ageRangeUnit: string; // New field for unit (months/years)
  unit: string;
  unitPrice: number;
  quantity: number;
  alibabaShippingCost: number;
  exchangeRates: number;
  forwardersFee: number;
  lalamove: number;
  packagingCost: number;
  actualPrice: number;
  applyTransactionFee: boolean;
  linkToPost: string;
  bulkQuantity: number;
  bulkWeight: number;
  weightPerPiece: number;
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
  applyTransactionFee?: boolean;
  bulkWeight?: number;
  bulkQuantity?: number;
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
  weightPerPiece: number;
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
 * Age Range Options - Combined pre-formatted options
 */
export const AGE_RANGE_OPTIONS = [
  { label: '0-3 months', value: '0-3 months' },
  { label: '3-6 months', value: '3-6 months' },
  { label: '6-9 months', value: '6-9 months' },
  { label: '9-12 months', value: '9-12 months' },
  { label: '12-18 months', value: '12-18 months' },
  { label: '18-24 months', value: '18-24 months' },
  { label: '2-3 years', value: '2-3 years' },
  { label: '3-6 years', value: '3-6 years' },
  { label: '6-9 years', value: '6-9 years' },
  { label: '9-12 years', value: '9-12 years' },
] as const;

/**
 * Age Range Options - Start Numbers
 */
export const AGE_RANGE_START_OPTIONS = [
  { label: '0', value: '0' },
  { label: '3', value: '3' },
  { label: '6', value: '6' },
  { label: '9', value: '9' },
  { label: '12', value: '12' },
  { label: '18', value: '18' },
  { label: '24', value: '24' },
] as const;

/**
 * Age Range Options - End Numbers
 */
export const AGE_RANGE_END_OPTIONS = [
  { label: '1', value: '1' },
  { label: '2', value: '2' },
  { label: '3', value: '3' },
  { label: '6', value: '6' },
  { label: '9', value: '9' },
  { label: '12', value: '12' },
  { label: '18', value: '18' },
  { label: '24', value: '24' },
  { label: '36', value: '36' },
] as const;

/**
 * Age Range Options - Units
 */
export const AGE_RANGE_UNIT_OPTIONS = [
  { label: 'months', value: 'months' },
  { label: 'years', value: 'years' },
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

export const PAYMENT_METHOD_OPTIONS = [
  { label: 'Cash', value: 'CASH' },
  { label: 'Bank Transfer', value: 'BANK' },
  { label: 'GCash', value: 'GCASH' },
  { label: 'Check', value: 'CHECK' },
  { label: 'Credit / Debit Card', value: 'CARD' },
  { label: 'Other', value: 'OTHER' },
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
  '2-PC': '2PC',
  '3-PC': '3PC',
  '4-PC': '4PC',
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
  'bulkWeight',
  'weightPerPiece',
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
  'linkToPost',
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
  'bulkQuantity',
  'bulkWeight',
  'weightPerPiece',
] as const;
