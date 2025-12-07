import { IconTruckDelivery } from '@tabler/icons-react';
import type { ModuleConfig, IconComponent } from '@/core/ModuleRegistry';

export const truckAssignmentsModule: ModuleConfig = {
  id: 'trucking-operations-truck-assignments',
  name: 'Truck Assignments',
  version: '1.0.0',
  enabled: true,
  navigation: [
    {
      label: 'Truck Assignments',
      path: '/trucking/operations/truck-assignments',
      icon: IconTruckDelivery as IconComponent,
      order: 2,
      business: ['trucking'],
      workspace: ['operations'],
    },
  ],
  routes: [
    {
      path: '/trucking/operations/truck-assignments',
      component: async () =>
        import('./components/TruckAssignmentsPage').then((mod) => ({
          default: mod.TruckAssignmentsPage,
        })),
      protected: true,
    },
  ],
  permissions: ['admin', 'manager', 'operations'],
  metadata: {
    description:
      'Manage and review truck assignment schedules, drivers, and helpers.',
    tags: ['trucking', 'operations', 'assignments', 'scheduling'],
  },
};
