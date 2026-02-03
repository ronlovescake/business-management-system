import { IconTruckDelivery } from '@tabler/icons-react';
import { createOperationsModuleConfig } from '@/modules/shared/operations/moduleConfig';

export const vehicleAssignmentsModule = createOperationsModuleConfig({
  id: 'trucking-operations-vehicle-assignments',
  name: 'Vehicle Assignments',
  path: '/trucking/operations/vehicle-assignments',
  icon: IconTruckDelivery,
  order: 2,
  business: ['trucking'],
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
});
