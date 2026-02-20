/**
 * GM Dashboard Page Route Handler
 */

import { DashboardRoutePage } from '@/app/operations/dashboard/_shared/DashboardRoutePage';
import { renderGmOperationsPage } from '@/app/general-merchandise/operations/_shared/renderGmOperationsPage';

export default async function Page() {
  return renderGmOperationsPage(
    '/general-merchandise/operations/dashboard',
    <DashboardRoutePage />
  );
}
