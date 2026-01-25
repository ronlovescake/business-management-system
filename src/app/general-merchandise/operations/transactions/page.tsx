import type { Metadata } from 'next';
import { TransactionsPage } from '@/modules/clothing/operations/transactions/components/TransactionsPage';
import { TransactionsErrorBoundary } from '@/modules/clothing/operations/transactions/components/TransactionsErrorBoundary';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';

export const metadata: Metadata = {
  title: 'General Merchandise Transactions',
};

export default async function GeneralMerchandiseTransactionsRoute() {
  const hasAccess = await hasModuleAccess(
    '/general-merchandise/operations/transactions'
  );
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <TransactionsErrorBoundary>
        <TransactionsPage apiBasePath="/api/general-merchandise" />
      </TransactionsErrorBoundary>
    </PermissionGuard>
  );
}
