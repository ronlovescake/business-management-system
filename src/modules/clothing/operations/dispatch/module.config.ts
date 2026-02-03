/**
 * Dispatch Module Configuration
 *
 * Registers the Dispatch module with the application's module system.
 */

import { IconTruckDelivery } from '@tabler/icons-react';
import { createOperationsModuleConfig } from '@/modules/shared/operations/moduleConfig';

export const dispatchModule = createOperationsModuleConfig({
  id: 'clothing-dispatch',
  name: 'Dispatch',
  path: '/clothing/operations/dispatch',
  icon: IconTruckDelivery,
  order: 7,
  business: ['clothing'],
});
