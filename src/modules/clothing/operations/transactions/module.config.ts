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
import type { ModuleConfig } from '@/core/ModuleRegistry';

export const transactionsModule: ModuleConfig = {
  id: 'clothing-transactions',
  name: 'Transactions',
  version: '1.0.0',
  enabled: true,

  navigation: [
    {
      label: 'Transactions',
      path: '/clothing/operations/transactions',
      icon: IconReceipt as unknown as React.FC<{
        size?: number;
        stroke?: number;
      }>,
      order: 1,
      business: ['clothing'],
      workspace: ['operations'],
    },
  ],

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
};
