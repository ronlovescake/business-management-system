/**
 * Shipments Module Configuration
 *
 * Defines the module metadata for the Shipments module.
 */

import { IconAnchor } from '@tabler/icons-react';
import { createOperationsModuleConfig } from '@/modules/shared/operations/moduleConfig';

export const shipmentsModule = createOperationsModuleConfig({
  id: 'clothing-operations-shipments',
  name: 'Shipments',
  path: '/clothing/operations/shipments',
  icon: IconAnchor,
  order: 6,
  business: ['clothing'],
});
