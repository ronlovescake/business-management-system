import { IconRoute } from '@tabler/icons-react';
import type { ModuleConfig, IconComponent } from '@/core/ModuleRegistry';

export const truckingTripsModule: ModuleConfig = {
  id: 'trucking-operations-trips',
  name: 'Trips',
  version: '0.1.0',
  enabled: true,
  navigation: [
    {
      label: 'Trips',
      path: '/trucking/operations/trips',
      icon: IconRoute as IconComponent,
      order: 1,
      business: ['trucking'],
      workspace: ['operations'],
    },
  ],
};
