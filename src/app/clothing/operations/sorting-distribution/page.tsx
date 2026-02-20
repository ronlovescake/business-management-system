/**
 * Sorting Distribution Page Route Handler
 *
 * This module has been refactored for:
 * - Modularity: Separated into services, hooks, and components
 * - Maintainability: Clear separation of concerns
 * - Reusability: All logic can be reused across the application
 * - Type Safety: Full TypeScript strict mode compliance
 * Direct import path used to optimize compilation speed.
 *
 * Module Structure:
 * - /types/sortingDistribution.types.ts - All TypeScript interfaces and types
 * - /services/SortingDistributionService.ts - Business logic and data operations
 * - /hooks/useSortingDistributionData.ts - Data management hook
 * - /hooks/useSortingDistributionForm.ts - Form management hook
 * - /components/InfoSection.tsx - Product selection and statistics display
 * - /components/QuantityPillButtons.tsx - Quantity selector buttons
 * - /components/SortingDistributionPage.tsx - Main page component
 *
 * Original: 1,157 lines
 * New: 12 lines (99.0% reduction)
 *
 * Features Preserved:
 * ✓ 5-column data grid (Quantity, Percentage, Group Number, Distribution, Checkbox)
 * ✓ Product selection with "Sorting" status filter
 * ✓ Auto-populate ordered quantity from products
 * ✓ Auto-populate total reservation from transactions
 * ✓ Unique quantity pill buttons
 * ✓ Auto-calculated fields (percentage, groupNumber, distribution)
 * ✓ Statistics display (Est. Qty. Received, Available Stock, etc.)
 * ✓ Auto-save with debouncing (1 second)
 * ✓ Load/save distribution data
 * ✓ Paste support (Quantity column only)
 * ✓ Header menu (clear Quantity column)
 * ✓ Spacebar to toggle all checkboxes
 * ✓ Greyed-out rows for checked items
 */

import { SortingDistributionRoutePage } from '@/app/operations/sorting-distribution/_shared/SortingDistributionRoutePage';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';

export default async function Page() {
  return renderOperationsPage(
    '/clothing/operations/sorting-distribution',
    <SortingDistributionRoutePage />
  );
}
