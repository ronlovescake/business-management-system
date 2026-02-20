import { CustomersPage } from '@/modules/clothing/operations/customers/components/CustomersPage';
import { CustomersErrorBoundary } from '@/modules/clothing/operations/customers/components/CustomersErrorBoundary';

export function CustomersRoutePage() {
  return (
    <CustomersErrorBoundary>
      <CustomersPage />
    </CustomersErrorBoundary>
  );
}
