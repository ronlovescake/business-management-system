import type { Metadata } from 'next';
import { TransactionsRoutePage } from '@/app/operations/transactions/_shared/TransactionsRoutePage';
import { renderGmOperationsPage } from '@/app/general-merchandise/operations/_shared/renderGmOperationsPage';

export const metadata: Metadata = {
  title: 'General Merchandise Transactions',
};

export default async function GeneralMerchandiseTransactionsRoute() {
  return renderGmOperationsPage(
    '/general-merchandise/operations/transactions',
    <TransactionsRoutePage apiBasePath="/api/general-merchandise" />
  );
}
