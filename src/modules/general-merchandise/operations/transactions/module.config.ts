import { IconReceipt } from '@tabler/icons-react';
import { createOperationsModuleConfig } from '@/modules/shared/operations/moduleConfig';

export const generalMerchandiseTransactionsModule =
  createOperationsModuleConfig({
    id: 'general-merchandise-transactions',
    name: 'Transactions',
    path: '/general-merchandise/operations/transactions',
    icon: IconReceipt,
    order: 1,
    business: ['general-merchandise'],
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
  });
