import { IconUsers } from '@tabler/icons-react';
import { createOperationsModuleConfig } from '@/modules/shared/operations/moduleConfig';

/**
 * Customers Module Configuration
 * Registers the customers module in the application's module registry
 */
export const customersModule = createOperationsModuleConfig({
  id: 'clothing-customers',
  name: 'Customers',
  path: '/clothing/operations/customers',
  icon: IconUsers,
  order: 2,
  business: ['clothing'],
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
});
