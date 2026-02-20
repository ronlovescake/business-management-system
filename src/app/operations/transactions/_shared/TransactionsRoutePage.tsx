import { TransactionsPage } from '@/modules/clothing/operations/transactions/components/TransactionsPage';
import { TransactionsErrorBoundary } from '@/modules/clothing/operations/transactions/components/TransactionsErrorBoundary';

type TransactionsRoutePageProps = {
  apiBasePath?: string;
};

export function TransactionsRoutePage(props: TransactionsRoutePageProps) {
  const { apiBasePath } = props;

  return (
    <TransactionsErrorBoundary>
      <TransactionsPage apiBasePath={apiBasePath} />
    </TransactionsErrorBoundary>
  );
}
