import { IconUsers } from '@tabler/icons-react';
import type { ModuleConfig } from '@/core/ModuleRegistry';

/**
 * GM Customers Module Configuration
 */
export const generalMerchandiseCustomersModule: ModuleConfig = {
  id: 'general-merchandise-customers',
  name: 'Customers',
  version: '1.0.0',
  enabled: true,

  navigation: [
    {
      label: 'Customers',
      path: '/general-merchandise/operations/customers',
      icon: IconUsers as unknown as React.FC<{
        size?: number;
        stroke?: number;
      }>,
      order: 2,
      business: ['general-merchandise'],
      workspace: ['operations'],
    },
  ],

  permissions: ['admin', 'manager', 'operations'],

  metadata: {
    description:
      'Manage GM customer information, contacts, and business details with CSV import/export',
    tags: ['customers', 'contacts', 'crm', 'business', 'operations'],
  },
};
