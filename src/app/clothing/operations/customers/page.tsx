/**
 * Customers Route Handler
 * Delegates to the modular CustomersPage component
 * Direct import path used to optimize compilation speed
 */
import { CustomersPage } from '@/modules/clothing/operations/customers/components/CustomersPage';

export default function Page() {
  return <CustomersPage />;
}
