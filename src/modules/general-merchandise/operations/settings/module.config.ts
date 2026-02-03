/**
 * GM Settings Module Configuration
 */

import { IconSettings } from '@tabler/icons-react';
import { createOperationsModuleConfig } from '@/modules/shared/operations/moduleConfig';

export const generalMerchandiseSettingsModule = createOperationsModuleConfig({
  id: 'general-merchandise-settings',
  name: 'Settings',
  path: '/general-merchandise/operations/settings',
  icon: IconSettings,
  order: 999,
  business: ['general-merchandise'],
  routes: [
    {
      path: '/general-merchandise/operations/settings',
      component: async () => {
        const { default: Page } = await import(
          '@/app/general-merchandise/operations/settings/page'
        );
        return { default: Page };
      },
      protected: true,
    },
  ],
  permissions: ['admin', 'manager'],
  metadata: {
    description: 'System settings and module marketplace for managing plugins',
    author: 'Business Management System',
    tags: ['settings', 'marketplace', 'modules', 'plugins', 'configuration'],
  },
});
