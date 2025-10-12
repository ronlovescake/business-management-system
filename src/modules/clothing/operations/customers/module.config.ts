import { IconUsers } from '@tabler/icons-react';
import type { ModuleConfig } from '@/core/ModuleRegistry';

/**
 * Customers Module Configuration
 * Registers the customers module in the application's module registry
 */
export const customersModule: ModuleConfig = {
  id: 'clothing-customers',
  name: 'Customers',
  version: '1.0.0',
  enabled: true,

  navigation: [
    {
      label: 'Customers',
      path: '/clothing/operations/customers',
      icon: IconUsers as unknown as React.FC<{
        size?: number;
        stroke?: number;
      }>,
      order: 2, // After dashboard (0)
      business: ['clothing'],
      workspace: ['operations'],
    },
  ],

  routes: [
    {
      path: '/clothing/operations/customers',
      component: async () => {
        const { CustomersPage } = await import('./components/CustomersPage');
        return { default: CustomersPage };
      },
      protected: true,
    },
  ],

  permissions: ['admin', 'manager', 'operations'],

  metadata: {
    description:
      'Manage customer information, contacts, and business details with CSV import/export',
    tags: ['customers', 'contacts', 'crm', 'business', 'operations'],
  },
};
