/**
 * GM Dashboard Page Route Handler
 */

import { DashboardRoutePage } from '@/app/operations/dashboard/_shared/DashboardRoutePage';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';

export default async function Page() {
  return renderOperationsPage(
    '/general-merchandise/operations/dashboard',
    <DashboardRoutePage />
  );
}
