import { IconUsers } from '@tabler/icons-react';
import { createOperationsModuleConfig } from '@/modules/shared/operations/moduleConfig';

export const clothingInvestorsModule = createOperationsModuleConfig({
  id: 'clothing-investors',
  name: 'Investors',
  path: '/clothing/accounting/investors',
  icon: IconUsers,
  order: 5,
  business: ['clothing'],
  workspace: ['accounting'],
  permissions: ['ADMIN', 'SUPER_ADMIN'],
});
