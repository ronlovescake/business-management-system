import { IconTruck } from '@tabler/icons-react';
import { createOperationsModuleConfig } from '@/modules/shared/operations/moduleConfig';

export const fleetRegistryModule = createOperationsModuleConfig({
  id: 'trucking-operations-fleet-registry',
  name: 'Fleet Registry',
  path: '/trucking/operations/fleet-registry',
  icon: IconTruck,
  order: 3,
  business: ['trucking'],
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
});
