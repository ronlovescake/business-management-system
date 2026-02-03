import { IconRoute } from '@tabler/icons-react';
import { createOperationsModuleConfig } from '@/modules/shared/operations/moduleConfig';

export const truckingTripsModule = createOperationsModuleConfig({
  id: 'trucking-operations-trips',
  name: 'Trips',
  path: '/trucking/operations/trips',
  icon: IconRoute,
  order: 1,
  business: ['trucking'],
  version: '0.1.0',
});
