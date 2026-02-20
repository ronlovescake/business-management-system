/**
 * Customers Route Handler
 * Delegates to the shared customers route wrapper
 */
import { CustomersRoutePage } from '@/app/operations/customers/_shared/CustomersRoutePage';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';

export default async function Page() {
  return renderOperationsPage(
    '/clothing/operations/customers',
    <CustomersRoutePage />
  );
}
