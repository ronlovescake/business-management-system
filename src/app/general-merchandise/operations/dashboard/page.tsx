/**
 * GM Dashboard Page Route Handler
 */

import { DashboardPage } from '@/modules/clothing/operations/dashboard/components/DashboardPage';
import { renderGmOperationsPage } from '@/app/general-merchandise/operations/_shared/renderGmOperationsPage';

export default async function Page() {
  return renderGmOperationsPage(
    '/general-merchandise/operations/dashboard',
    <DashboardPage />
  );
}
