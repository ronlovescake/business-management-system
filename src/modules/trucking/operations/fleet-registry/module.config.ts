import { IconTruck } from '@tabler/icons-react';
import type { ModuleConfig, IconComponent } from '@/core/ModuleRegistry';

export const fleetRegistryModule: ModuleConfig = {
  id: 'trucking-operations-fleet-registry',
  name: 'Fleet Registry',
  version: '1.0.0',
  enabled: true,
  navigation: [
    {
      label: 'Fleet Registry',
      path: '/trucking/operations/fleet-registry',
      icon: IconTruck as IconComponent,
      order: 3,
      business: ['trucking'],
      workspace: ['operations'],
    },
  ],
  routes: [
    {
      path: '/trucking/operations/fleet-registry',
      component: async () =>
        import('./components/FleetRegistryPage').then((mod) => ({
          default: mod.FleetRegistryPage,
        })),
      protected: true,
    },
  ],
  permissions: ['admin', 'manager', 'operations'],
  metadata: {
    description: 'Registry of fleet units with statuses, documents, and specs.',
    tags: ['fleet', 'trucking', 'registry', 'operations'],
  },
};
