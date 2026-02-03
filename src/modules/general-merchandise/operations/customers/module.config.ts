import { IconUsers } from '@tabler/icons-react';
import { createOperationsModuleConfig } from '@/modules/shared/operations/moduleConfig';

/**
 * GM Customers Module Configuration
 */
export const generalMerchandiseCustomersModule = createOperationsModuleConfig({
  id: 'general-merchandise-customers',
  name: 'Customers',
  path: '/general-merchandise/operations/customers',
  icon: IconUsers,
  order: 2,
  business: ['general-merchandise'],
  permissions: ['admin', 'manager', 'operations'],
  metadata: {
    description:
      'Manage GM customer information, contacts, and business details with CSV import/export',
    tags: ['customers', 'contacts', 'crm', 'business', 'operations'],
  },
});
