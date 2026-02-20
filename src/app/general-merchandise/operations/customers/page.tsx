/**
 * GM Customers Route Handler
 * Delegates to the shared customers route wrapper
 */
import { CustomersRoutePage } from '@/app/operations/customers/_shared/CustomersRoutePage';
import { renderGmOperationsPage } from '@/app/general-merchandise/operations/_shared/renderGmOperationsPage';

export default async function Page() {
  return renderGmOperationsPage(
    '/general-merchandise/operations/customers',
    <CustomersRoutePage />
  );
}
