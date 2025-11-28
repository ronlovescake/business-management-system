/**
 * Operations Workspace Barrel Export
 *
 * IMPORTANT: Due to naming conflicts between modules (CSVImportResult, ValidationResult,
 * IconComponent, PriceTier, etc.), this file intentionally does NOT re-export everything.
 *
 * Always import directly from specific modules to avoid ambiguity:
 *
 * @example
 * // ✅ Correct - Import from specific module
 * import { CustomerService } from '@/modules/clothing/operations/customers';
 * import { ProductService } from '@/modules/clothing/operations/products';
 * import type { CSVImportResult } from '@/modules/clothing/operations/customers';
 *
 * // ❌ Incorrect - Ambiguous due to type conflicts
 * import { CSVImportResult } from '@/modules/clothing/operations';
 */

// Re-export only the module configs for workspace registration
export { customersModule } from './customers/module.config';
export { dashboardModule } from './dashboard/module.config';
export { pricesModule } from './prices/module.config';
export { productsModule } from './products/module.config';
export { settingsModule } from './settings/module.config';
export { shipmentsModule } from './shipments/module.config';
export { sortingDistributionModule } from './sorting-distribution/module.config';
export { transactionsModule } from './transactions/module.config';
