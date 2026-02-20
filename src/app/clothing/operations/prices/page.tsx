/**
 * Prices Page - Route Handler
 *
 * Delegates to the modular PricesPage component from the prices module.
 * Direct import path used to optimize compilation speed.
 * Original implementation: 1,679 lines
 * New implementation: 11 lines (99.3% reduction)
 */

import { PricesRoutePage } from '@/app/operations/prices/_shared/PricesRoutePage';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';

export default async function Page() {
  return renderOperationsPage(
    '/clothing/operations/prices',
    <PricesRoutePage />
  );
}
