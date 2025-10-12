/**
 * Sorting Distribution Module
 *
 * Public API exports for the Sorting Distribution module.
 * This file serves as the entry point for importing module components, hooks, and services.
 */

// Components
export { InfoSection } from './components/InfoSection';
export { QuantityPillButtons } from './components/QuantityPillButtons';
export { SortingDistributionPage } from './components/SortingDistributionPage';

// Hooks
export { useSortingDistributionData } from './hooks/useSortingDistributionData';
export { useSortingDistributionForm } from './hooks/useSortingDistributionForm';
export type { UseSortingDistributionDataReturn } from './hooks/useSortingDistributionData';
export type { UseSortingDistributionFormReturn } from './hooks/useSortingDistributionForm';

// Services
export { SortingDistributionService } from './services/SortingDistributionService';

// Types
export type {
  DistributionRow,
  Product,
  Transaction,
  SortingDistributionStatistics,
  SortingDistributionFormData,
  SortingDistributionData,
  SortingDistributionLoadResponse,
  SortingDistributionSaveRequest,
  SortingDistributionSaveResponse,
  ValidationResult,
  ColumnId,
  GridColumnConfig,
  GridCellWithCursor,
} from './types/sortingDistribution.types';

// Constants
export {
  GRID_ROW_COUNT,
  AUTO_SAVE_DELAY,
  DEFAULT_DISTRIBUTION_ROW,
  GRID_COLUMNS,
  SORTING_SHIPMENT_STATUS,
  CUSTOM_GRID_STYLES,
} from './types/sortingDistribution.types';

// Module Configuration
export { sortingDistributionModule } from './module.config';
