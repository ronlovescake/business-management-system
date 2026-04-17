import type { Metadata } from 'next';
import { TransactionsRoutePage } from '@/app/operations/transactions/_shared/TransactionsRoutePage';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';

export const metadata: Metadata = {
  title: 'General Merchandise Transactions',
};

export default async function GeneralMerchandiseTransactionsRoute() {
  return renderOperationsPage(
    '/general-merchandise/operations/transactions',
    <TransactionsRoutePage apiBasePath="/api/general-merchandise" />
  );
}
