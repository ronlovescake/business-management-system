/**
 * Transactions Module Configuration
 *
 * ==============================================================================
 * Module: Transactions (Clothing → Operations)
 * ==============================================================================
 *
 * This module handles all transaction operations including:
 * - Transaction CRUD with complex business logic
 * - Invoice generation with customer consolidation
 * - Packing list generation
 * - Distribution slip generation
 * - Customer validation (banned + high cancellation rate)
 * - Order status auto-population
 * - Unit Price calculation (Tier Price - Discount)
 * - Line Total calculation ((Quantity × Unit Price) - Adjustment)
 */

import { IconReceipt } from '@tabler/icons-react';
import { createOperationsModuleConfig } from '@/modules/shared/operations/moduleConfig';

export const transactionsModule = createOperationsModuleConfig({
  id: 'clothing-transactions',
  name: 'Transactions',
  path: '/clothing/operations/transactions',
  icon: IconReceipt,
  order: 1,
  business: ['clothing'],
  routes: [
    {
      path: '/clothing/operations/transactions',
      component: async () => {
        const { TransactionsPage } = await import(
          './components/TransactionsPage'
        );
        return { default: TransactionsPage };
      },
      protected: true,
    },
  ],
  permissions: ['admin', 'manager', 'operations', 'finance'],
  metadata: {
    description:
      'Manage transactions with invoice generation, packing lists, and distribution slips',
    tags: ['transactions', 'invoices', 'orders', 'critical', 'operations'],
  },
});
