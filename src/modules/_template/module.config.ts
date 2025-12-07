import { IconLayoutGrid } from '@tabler/icons-react';
import type { ModuleConfig, IconComponent } from '@/core/ModuleRegistry';

/**
 * New Module Template Configuration (Trips-style layout)
 *
 * Copy this folder, rename it, and update the paths/labels/id below when creating a new module.
 * This template is intentionally generic (not tied to any business/workspace) but ships with
 * a full stats-cards + control-panel + table + summary bar layout.
 */

export const templateModule: ModuleConfig = {
  id: 'template-module',
  name: 'New Module Template',
  version: '1.0.0',
  enabled: false, // keep disabled until you wire a concrete module
  navigation: [
    {
      label: 'New Module Template',
      path: '/template/module', // update to your target path
      icon: IconLayoutGrid as IconComponent,
      order: 999,
      business: ['clothing', 'trucking'], // update as needed
      workspace: ['operations', 'employees'], // update as needed
    },
  ],
  routes: [
    {
      path: '/template/module', // update to your target path
      component: async () =>
        import('./components/TemplatePage').then((mod) => ({
          default: mod.TemplatePage,
        })),
      protected: true,
    },
  ],
  permissions: ['admin', 'manager', 'user'],
  metadata: {
    description: 'Reusable module template with trips-style layout',
    author: 'Template',
    tags: ['template', 'trips-layout'],
  },
};
