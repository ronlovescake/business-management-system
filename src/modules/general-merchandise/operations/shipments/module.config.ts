/**
 * GM Shipments Module Configuration
 */

import { IconAnchor } from '@tabler/icons-react';
import { createOperationsModuleConfig } from '@/modules/shared/operations/moduleConfig';

export const generalMerchandiseShipmentsModule = createOperationsModuleConfig({
  id: 'general-merchandise-operations-shipments',
  name: 'Shipments',
  path: '/general-merchandise/operations/shipments',
  icon: IconAnchor,
  order: 6,
  business: ['general-merchandise'],
});
