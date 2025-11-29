/**
 * Products Page Route Handler
 *
 * This module has been refactored for:
 * - Modularity: Separated into services, hooks, and components
 * - Maintainability: Clear separation of concerns
 * - Reusability: All logic can be reused across the application
 * - Type Safety: Full TypeScript strict mode compliance
 *
 * Module Structure:
 * - /types/product.types.ts - All TypeScript interfaces and types
 * - /services/ProductService.ts - Business logic and data operations
 * - /hooks/useProductsData.ts - Data management hook
 * - /hooks/useProductForm.ts - Form management hook
 * - /components/ProductStatsCards.tsx - Statistics display
 * - /components/AddProductModal.tsx - Add/Edit modal
 * - /components/ProductsPage.tsx - Main page component
 *
 * Original: 2,763 lines
 * New: 12 lines (99.6% reduction)
 *
 * Features Preserved:
 * ✓ 36-column data grid
 * ✓ Product Code auto-generation
 * ✓ Financial calculations (COGS, Profit, Markup)
 * ✓ Shipment integration
 * ✓ CSV import/export
 * ✓ Multi-cell paste
 * ✓ Search with Ctrl+F
 * ✓ Add/Edit product modal
 * ✓ Real-time statistics
 *
 * Note: Direct import path used to optimize compilation speed
 */

import type { Metadata } from 'next';
import { ProductsPage } from '@/modules/clothing/operations/products/components/ProductsPage';
import { ProductsErrorBoundary } from '@/modules/clothing/operations/products/components/ProductsErrorBoundary';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';

export const metadata: Metadata = {
  title: 'Products',
};

export default async function Page() {
  const hasAccess = await hasModuleAccess('/clothing/operations/products');
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <ProductsErrorBoundary>
        <ProductsPage />
      </ProductsErrorBoundary>
    </PermissionGuard>
  );
}
