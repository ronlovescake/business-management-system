import type { Metadata } from 'next';
import { TransactionsPage } from '@/modules/clothing/operations/transactions/components/TransactionsPage';
import { TransactionsErrorBoundary } from '@/modules/clothing/operations/transactions/components/TransactionsErrorBoundary';
import { renderGmOperationsPage } from '@/app/general-merchandise/operations/_shared/renderGmOperationsPage';

export const metadata: Metadata = {
  title: 'General Merchandise Transactions',
};

export default async function GeneralMerchandiseTransactionsRoute() {
  return renderGmOperationsPage(
    '/general-merchandise/operations/transactions',
    <TransactionsErrorBoundary>
      <TransactionsPage apiBasePath="/api/general-merchandise" />
    </TransactionsErrorBoundary>
  );
}
