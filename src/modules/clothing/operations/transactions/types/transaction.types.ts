/**
 * Transaction Module Types
 *
 * Comprehensive type definitions for the Transactions module.
 * These types maintain strict TypeScript compliance and cover all transaction operations.
 */

import type {
  CellEditEvent,
  HandsontableColumn,
} from '@/components/ui/HandsontableGrid';

// ============================================================================
// CORE TRANSACTION TYPES
// ============================================================================

/**
 * Transaction Data Interface
 * Represents a single transaction with all its fields.
 * Some fields are nullable to handle empty/incomplete transactions.
 */
export interface TransactionData {
  id?: number;
  'Order Date': string;
  Customers: string;
  'Product Code': string;
  Quantity: number | null;
  'Unit Price': number | null;
  Discount: number | null;
  Adjustment: number | null;
  'Line Total': number | null;
  'Order Status': string | null;
  Notes: string;
  'Invoice Date': string;
  'Packed Date': string;
  'Shipment Code': string;
  version?: number; // For optimistic locking
}

/**
 * Price Tier Interface
 * Represents a price tier from the prices API.
 * Used for unit price calculation based on quantity.
 */
export interface PriceTier {
  'Product Code': string;
  'Lower Limit': number;
  'Upper Limit': number;
  Prices: number;
}

/**
 * Product to Shipment Mapping
 * Maps product codes to shipment codes and statuses.
 */
export interface ProductShipmentMapping {
  shipmentCode: Record<string, string>;
  shipmentStatus: Record<string, string>;
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Customer Validation Result
 * Result from customer validation checks (banned, high cancellation rate, etc.)
 */
export interface CustomerValidationResult {
  isValid: boolean;
  warnings: string[];
  customerData?: Record<string, unknown>;
}

/**
 * Customer Warning Data
 * Data for displaying customer warning modal.
 */
export interface CustomerWarningData {
  customerName: string;
  warnings: string[];
  onProceed: () => void;
  onCancel: () => void;
}

// ============================================================================
// MODAL/DIALOG TYPES
// ============================================================================

/**
 * Invoice Confirmation Data
 * Data displayed in invoice generation confirmation modal.
 */
export interface InvoiceConfirmationData {
  customers: number;
  warehouseOrders: number;
  preparedOrders: number;
  totalTransactions: number;
}

/**
 * Packing List Confirmation Data
 * Data displayed in packing list generation confirmation modal.
 */
export interface PackingListConfirmationData {
  eligibleTransactions: number;
  customers: number;
  totalValue: number;
}

/**
 * Distribution Confirmation Data
 * Data displayed in distribution slip generation confirmation modal.
 */
export interface DistributionConfirmationData {
  warehouseTransactions: number;
  customers: number;
  totalValue: number;
  totalQuantity: number;
}

// ============================================================================
// STATISTICS TYPES
// ============================================================================

/**
 * Transaction Statistics
 * Calculated statistics for stat cards display.
 */
export interface TransactionStatistics {
  totalTransactions: number;
  totalRevenue: number;
  inTransitTotal: number;
  warehouseTotal: number;
  preparedTotal: number;
  pendingPaymentTotal: number;
  uniqueCustomers: number;
  adjustmentTotal: number;
  shippedOrders: number;
  lineTotalExcludingCancelled: number;
}

// ============================================================================
// GRID/TABLE TYPES
// ============================================================================

/**
 * Column ID to Data Key Mapping
 * Maps grid column IDs to TransactionData keys for type-safe access.
 */
export type ColumnIdToKey = Record<string, keyof TransactionData>;

/**
 * Status Options
 * Available order status values for filtering and editing.
 */
export const ORDER_STATUS_OPTIONS = [
  'In Transit',
  'Warehouse',
  'Prepared',
  'Ready For Dispatch',
  'Checked Out',
  'On-Hold',
  'Pending Payment',
  'Shipped',
  'Cancelled',
  'Forfeited',
  'Voided',
] as const;

export type OrderStatus = (typeof ORDER_STATUS_OPTIONS)[number];

/**
 * Status Filter Options
 * Available status filters including "All Status" aggregator.
 */
export const STATUS_FILTER_OPTIONS = [
  'All Status',
  ...ORDER_STATUS_OPTIONS,
] as const;

export type StatusFilterOption = (typeof STATUS_FILTER_OPTIONS)[number];

/**
 * Statuses controlled by "All Status" filter
 */
export const ALL_STATUS_CONTROLLED_STATUSES: OrderStatus[] = [
  'In Transit',
  'Warehouse',
  'Prepared',
  'Ready For Dispatch',
  'Checked Out',
  'On-Hold',
  'Pending Payment',
];

// ============================================================================
// BATCH OPERATION TYPES
// ============================================================================

/**
 * Batch Update Reference
 * Used for tracking batch paste operations via refs.
 */
export interface BatchUpdateRef {
  isBatchMode: boolean;
  updates: Map<number, Partial<TransactionData>>;
}

// ============================================================================
// API PAYLOAD TYPES
// ============================================================================

/**
 * Invoice Generation Payload
 * Data sent to invoice generation API.
 */
export interface InvoiceGenerationPayload {
  transactions: TransactionData[];
  customers: Record<string, unknown>[];
}

/**
 * Distribution Generation Payload
 * Data sent to distribution generation API.
 */
export interface DistributionGenerationPayload {
  transactions: TransactionData[];
}

/**
 * Packing List Transaction
 * Transformed transaction format for packing list API.
 */
export interface PackingListTransaction {
  id: string;
  orderDate: string;
  customers: string;
  productCode: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  adjustment: number;
  lineTotal: number;
  status: string;
  notes: string;
  invoiceDate: string;
  packedDate: string;
  shipmentCode: string;
}

// ============================================================================
// HOOK RETURN TYPES
// ============================================================================

/**
 * Transaction Data Hook Return Type
 * Return value from useTransactionsData hook.
 */
export interface UseTransactionsDataReturn {
  transactions: TransactionData[];
  isLoading: boolean;
  filteredData: TransactionData[];
  statistics: TransactionStatistics;
  customerNames: string[];
  productCodes: string[];
  priceTiers: PriceTier[];
  productToShipmentMap: Record<string, string>;
  productToShipmentStatusMap: Record<string, string>;
  searchQuery: string;
  handleSearch: (query: string) => void;
  selectedStatuses: Set<string>;
  handleStatusFilter: (status: string) => void;
}

/**
 * Transaction Operations Hook Return Type
 * Return value from useTransactionOperations hook.
 */
export interface UseTransactionOperationsReturn {
  handleCellEdited: (
    edit: CellEditEvent<TransactionData>
  ) => void | Promise<void>;
  handleCSVImport: (file: File) => Promise<void>;
  handleGenerateInvoice: (
    visibleTransactions: TransactionData[]
  ) => Promise<void>;
  handleGeneratePackingList: (
    visibleTransactions: TransactionData[]
  ) => Promise<void>;
  handleGenerateDistribution: (
    visibleTransactions: TransactionData[]
  ) => Promise<void>;
}

// ============================================================================
// GRID CONFIGURATION TYPES
// ============================================================================

/**
 * Grid Columns Configuration
 * Column definitions for the transactions grid.
 */
export interface TransactionsGridColumns {
  columns: HandsontableColumn[];
  idToKey: ColumnIdToKey;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Sanitized Transaction
 * Transaction with all nullable numeric fields converted to non-null (0 as default).
 * Used for API operations that require non-null values.
 */
export type SanitizedTransaction = Omit<
  TransactionData,
  'Quantity' | 'Unit Price' | 'Discount' | 'Adjustment' | 'Line Total'
> & {
  Quantity: number;
  'Unit Price': number;
  Discount: number;
  Adjustment: number;
  'Line Total': number;
};
