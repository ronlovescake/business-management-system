import { CustomersPage } from '@/modules/clothing/operations/customers/components/CustomersPage';
import { CustomersErrorBoundary } from '@/modules/clothing/operations/customers/components/CustomersErrorBoundary';

export function CustomersRoutePage({
  directoryView = false,
}: {
  directoryView?: boolean;
}) {
  return (
    <CustomersErrorBoundary>
      <CustomersPage directoryView={directoryView} />
    </CustomersErrorBoundary>
  );
}
