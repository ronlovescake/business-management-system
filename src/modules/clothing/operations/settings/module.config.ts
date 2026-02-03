/**
 * Settings Module Configuration
 *
 * ==============================================================================
 * Module: Settings (Clothing → Operations)
 * ==============================================================================
 *
 * This module provides:
 * - Module marketplace browser
 * - Installed modules management
 * - Module updates checking
 * - Dependency tree visualization
 * - Module installation/uninstallation
 */

import { IconSettings } from '@tabler/icons-react';
import { createOperationsModuleConfig } from '@/modules/shared/operations/moduleConfig';

export const settingsModule = createOperationsModuleConfig({
  id: 'clothing-settings',
  name: 'Settings',
  path: '/clothing/operations/settings',
  icon: IconSettings,
  order: 999,
  business: ['clothing'],
  routes: [
    {
      path: '/clothing/operations/settings',
      component: async () => {
        const { SettingsPage } = await import('./components/SettingsPage');
        return { default: SettingsPage };
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
