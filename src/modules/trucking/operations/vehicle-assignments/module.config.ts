import { IconTruckDelivery } from '@tabler/icons-react';
import type { ModuleConfig, IconComponent } from '@/core/ModuleRegistry';

export const vehicleAssignmentsModule: ModuleConfig = {
  id: 'trucking-operations-vehicle-assignments',
  name: 'Vehicle Assignments',
  version: '1.0.0',
  enabled: true,
  navigation: [
    {
      label: 'Vehicle Assignments',
      path: '/trucking/operations/vehicle-assignments',
      icon: IconTruckDelivery as IconComponent,
      order: 2,
      business: ['trucking'],
      workspace: ['operations'],
    },
  ],
  routes: [
    {
      path: '/trucking/operations/vehicle-assignments',
      component: async () =>
        import('./components/VehicleAssignmentsPage').then((mod) => ({
          default: mod.VehicleAssignmentsPage,
        })),
      protected: true,
    },
  ],
  permissions: ['admin', 'manager', 'operations'],
  metadata: {
    description:
      'Manage and review vehicle assignment schedules, drivers, and helpers.',
    tags: ['trucking', 'operations', 'assignments', 'scheduling'],
  },
};
