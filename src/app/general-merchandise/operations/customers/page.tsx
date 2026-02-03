/**
 * GM Customers Route Handler
 * Delegates to the shared CustomersPage component with GM API base path
 */
import { CustomersPage } from '@/modules/clothing/operations/customers/components/CustomersPage';
import { CustomersErrorBoundary } from '@/modules/clothing/operations/customers/components/CustomersErrorBoundary';
import { renderGmOperationsPage } from '@/app/general-merchandise/operations/_shared/renderGmOperationsPage';

export default async function Page() {
  return renderGmOperationsPage(
    '/general-merchandise/operations/customers',
    <CustomersErrorBoundary>
      <CustomersPage />
    </CustomersErrorBoundary>
  );
}
