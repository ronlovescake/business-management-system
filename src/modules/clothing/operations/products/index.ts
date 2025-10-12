/**
 * Products Module Public API
 * Export all public components, hooks, services, and types
 */

// Main Component
export { ProductsPage } from './components/ProductsPage';

// Sub-components
export { ProductStatsCards } from './components/ProductStatsCards';
export { AddProductModal } from './components/AddProductModal';

// Hooks
export { useProductsData } from './hooks/useProductsData';
export { useProductForm } from './hooks/useProductForm';

// Services
export { ProductService } from './services/ProductService';

// Types
export type {
  ProductData,
  ProductFormData,
  ProductStatistics,
  ProductWithSearchIndex,
  CSVImportResult,
  ProductValidationResult,
  ShipmentData,
  ProductCalculationInputs,
  ProductCalculationResults,
  ProductFilterState,
  ProductSortField,
  ProductSortDirection,
  ProductSortState,
  ProductColumnKey,
  ColumnAlignment,
  GridCellWithCursor,
} from './types/product.types';

// Constants
export {
  TRANSACTION_FEE_RATE,
  SUGGESTED_PRICE_MARKUP,
  AGE_RANGE_OPTIONS,
  UNIT_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  SKIP_WORDS,
  PRODUCT_CODE_SPECIAL_CASES,
  TWO_DECIMAL_COLUMNS,
  CENTER_ALIGN_COLUMNS,
  LEFT_ALIGN_COLUMNS,
  RIGHT_ALIGN_COLUMNS,
} from './types/product.types';

// Module Configuration
export { productsModule } from './module.config';
