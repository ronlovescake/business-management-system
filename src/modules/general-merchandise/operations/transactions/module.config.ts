import { IconReceipt } from '@tabler/icons-react';
import type { ModuleConfig } from '@/core/ModuleRegistry';

export const generalMerchandiseTransactionsModule: ModuleConfig = {
  id: 'general-merchandise-transactions',
  name: 'Transactions',
  version: '1.0.0',
  enabled: true,
  navigation: [
    {
      label: 'Transactions',
      path: '/general-merchandise/operations/transactions',
      icon: IconReceipt as unknown as React.FC<{
        size?: number;
        stroke?: number;
      }>,
      order: 1,
      business: ['general-merchandise'],
      workspace: ['operations'],
    },
  ],
  routes: [
    {
      path: '/general-merchandise/operations/transactions',
      component: async () => {
        const { GeneralMerchandiseTransactionsPage } = await import(
          './components/TransactionsPage'
        );
        return { default: GeneralMerchandiseTransactionsPage };
      },
      protected: true,
    },
  ],
  permissions: ['admin', 'manager', 'operations', 'finance'],
  metadata: {
    description:
      'Manage GM transactions with invoice generation, packing lists, and distribution slips',
    tags: ['transactions', 'invoices', 'orders', 'gm', 'operations'],
  },
};
