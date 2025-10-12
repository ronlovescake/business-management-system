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
import type { ModuleConfig } from '@/core/ModuleRegistry';

export const settingsModule: ModuleConfig = {
  id: 'clothing-settings',
  name: 'Settings',
  version: '1.0.0',
  enabled: true,

  navigation: [
    {
      label: 'Settings',
      path: '/clothing/operations/settings',
      icon: IconSettings as unknown as React.ComponentType<{
        size?: number;
        stroke?: number;
      }>,
      order: 999, // Last in navigation
      business: ['clothing'],
      workspace: ['operations'],
    },
  ],

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

  permissions: ['admin', 'manager'], // Restrict to admins and managers

  metadata: {
    description: 'System settings and module marketplace for managing plugins',
    author: 'Business Management System',
    tags: ['settings', 'marketplace', 'modules', 'plugins', 'configuration'],
  },
};
