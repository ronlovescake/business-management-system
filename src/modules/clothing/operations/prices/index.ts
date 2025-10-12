/**
 * Prices Module - Public API
 *
 * This module provides price management functionality with:
 * - Multi-tier pricing support
 * - Bulk price adjustments (percentage & fixed)
 * - CSV import/export
 * - Price statistics and analytics
 * - Search and filtering
 */

// Module Configuration
export { pricesModule } from './module.config';

// Types
export type {
  PriceData,
  PriceTier,
  PriceFormData,
  PriceStats,
  BulkAdjustmentConfig,
  ValidationResult,
  CSVImportResult,
  PriceWithSearchIndex,
  PriceColumnKey,
  PricesAPIResponse,
  PriceAPIError,
  PriceAdjustmentHistory,
  IconComponent,
} from './types/price.types';

// Services
export { PriceService } from './services/PriceService';
export { default as priceService } from './services/PriceService';

// Hooks
export { usePricesData } from './hooks/usePricesData';
export { usePriceForm } from './hooks/usePriceForm';

// Components
export { PriceStatsCards } from './components/PriceStatsCards';
export { AddPriceModal } from './components/AddPriceModal';
export { PricesPage } from './components/PricesPage';
