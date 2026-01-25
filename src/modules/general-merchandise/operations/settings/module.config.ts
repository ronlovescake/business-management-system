/**
 * GM Settings Module Configuration
 */

import { IconSettings } from '@tabler/icons-react';
import type { ModuleConfig } from '@/core/ModuleRegistry';

export const generalMerchandiseSettingsModule: ModuleConfig = {
  id: 'general-merchandise-settings',
  name: 'Settings',
  version: '1.0.0',
  enabled: true,

  navigation: [
    {
      label: 'Settings',
      path: '/general-merchandise/operations/settings',
      icon: IconSettings as unknown as React.ComponentType<{
        size?: number;
        stroke?: number;
      }>,
      order: 999,
      business: ['general-merchandise'],
      workspace: ['operations'],
    },
  ],

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
};
