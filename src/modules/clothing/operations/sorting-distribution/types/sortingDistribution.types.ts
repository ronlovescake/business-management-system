/**
 * Sorting Distribution Types
 *
 * Type definitions for the Sorting Distribution module.
 * Includes interfaces for distribution rows, products, statistics, and API data.
 */

/**
 * Distribution Row Data
 * Represents a single row in the distribution grid (100 rows total)
 */
export interface DistributionRow {
  quantity: number;
  percentage: number;
  groupNumber: string; // Format: "Number X" (auto-assigned for non-empty rows)
  distribution: number;
  checked: boolean;
}

/**
 * Product Data
 * Represents a product from the products table
 */
export interface Product {
  productCode: string | null;
  shipmentStatus: string | null;
  quantity: number;
}

/**
 * Transaction Data
 * Represents a transaction from the transactions table
 */
export interface Transaction {
  'Product Code': string;
  Quantity: number | null;
  Customers: string;
}

/**
 * Sorting Distribution Statistics
 * Calculated metrics for the distribution
 */
export interface SortingDistributionStatistics {
  estQtyReceived: number; // Sum of all quantities in grid
  totalReservation: number; // Total from transactions
  availableStock: number; // estQtyReceived - totalReservation
  totalCustomers: number; // Count of customers for selected product
  customerWithOrderQty: number; // Count of customers with selected quantity
  totalDistribution: number; // Sum of all distribution values
}

/**
 * Sorting Distribution Form Data
 * User input fields for the distribution form
 */
export interface SortingDistributionFormData {
  item: string; // Selected product code
  ordered: string; // Total ordered quantity (as string for display)
  selectedQuantity: number | null; // Selected pill button quantity
}

/**
 * Saved Distribution Data (from API)
 * Data structure returned from/sent to the API
 */
export interface SortingDistributionData {
  id?: number;
  productCode: string;
  selectedQuantity: number | null;
  rowNumber: number;
  quantity: number;
  percentage: number;
  groupNumber: string;
  distribution: number;
  checked: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * API Response for Load Operation
 */
export interface SortingDistributionLoadResponse {
  data: Array<{
    row_number: number;
    quantity: number;
    percentage: number;
    group_number: string;
    distribution: number;
    checked: boolean;
  }>;
  selectedQuantity: number | null;
}

/**
 * API Request for Save Operation
 */
export interface SortingDistributionSaveRequest {
  productCode: string;
  selectedQuantity: number | null;
  rows: DistributionRow[];
}

/**
 * API Response for Save Operation
 */
export interface SortingDistributionSaveResponse {
  success: boolean;
  savedCount: number;
  message?: string;
}

/**
 * Validation Result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Column Identifiers
 */
export type ColumnId =
  | 'quantity'
  | 'percentage'
  | 'groupNumber'
  | 'distribution'
  | 'checkbox';

/**
 * Grid Column Configuration
 */
export interface GridColumnConfig {
  id: ColumnId;
  title: string;
  width: number;
  grow: number;
  editable: boolean;
  readonly: boolean;
}

/**
 * Constants
 */

/**
 * Number of rows in the distribution grid
 */
export const GRID_ROW_COUNT = 100;

/**
 * Auto-save debounce delay (milliseconds)
 */
export const AUTO_SAVE_DELAY = 1000;

/**
 * Default empty distribution row
 */
export const DEFAULT_DISTRIBUTION_ROW: DistributionRow = {
  quantity: 0,
  percentage: 0,
  groupNumber: '',
  distribution: 0,
  checked: false,
};

/**
 * Column configurations for the grid
 */
export const GRID_COLUMNS: GridColumnConfig[] = [
  {
    id: 'quantity',
    title: 'Quantity',
    width: 200,
    grow: 1,
    editable: true,
    readonly: false,
  },
  {
    id: 'percentage',
    title: 'Percentage',
    width: 200,
    grow: 1,
    editable: false,
    readonly: true,
  },
  {
    id: 'groupNumber',
    title: 'Group Number',
    width: 200,
    grow: 1,
    editable: false,
    readonly: true,
  },
  {
    id: 'distribution',
    title: 'Distribution',
    width: 200,
    grow: 1,
    editable: false,
    readonly: true,
  },
  {
    id: 'checkbox',
    title: 'Checkbox',
    width: 200,
    grow: 1,
    editable: true,
    readonly: false,
  },
];

/**
 * Shipment Status Filter
 * Only products with this status are shown in the product selector
 */
export const SORTING_SHIPMENT_STATUS = 'Sorting';

/**
 * Custom Grid Styles
 * CSS for grid appearance (20px font, center alignment)
 */
export const CUSTOM_GRID_STYLES = `
  .data-grid-container * {
    font-size: 20px !important;
    font-family: Inter, sans-serif !important;
  }
  .data-grid-container canvas {
    font-size: 20px !important;
  }
  .data-grid-container .gdg-cell {
    font-size: 20px !important;
    font-family: Inter, sans-serif !important;
  }
  .data-grid-container .gdg-header {
    font-size: 20px !important;
    font-weight: 600 !important;
    font-family: Inter, sans-serif !important;
    text-align: center !important;
  }
  .data-grid-container .gdg-cell-text {
    font-size: 20px !important;
  }
  .data-grid-container [role="gridcell"] {
    font-size: 20px !important;
  }
  .data-grid-container [role="columnheader"] {
    font-size: 20px !important;
    font-weight: 600 !important;
    text-align: center !important;
    justify-content: center !important;
    display: flex !important;
    align-items: center !important;
  }
  .data-grid-container div {
    font-size: 20px !important;
  }
  .dvn-scroller {
    font-size: 20px !important;
  }
`;

/**
 * Helper type for grid cell with cursor
 */
export type GridCellWithCursor = {
  cursor?: string;
};
