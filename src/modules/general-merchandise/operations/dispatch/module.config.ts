/**
 * GM Dispatch Module Configuration
 */

import { IconTruckDelivery } from '@tabler/icons-react';
import { createOperationsModuleConfig } from '@/modules/shared/operations/moduleConfig';

export const generalMerchandiseDispatchModule = createOperationsModuleConfig({
  id: 'general-merchandise-dispatch',
  name: 'Dispatch',
  path: '/general-merchandise/operations/dispatch',
  icon: IconTruckDelivery,
  order: 7,
  business: ['general-merchandise'],
});
