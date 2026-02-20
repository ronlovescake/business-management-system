/**
 * Dashboard Route Handler
 *
 * This file now simply delegates to the modular DashboardPage component.
 * All business logic has been extracted to the module structure.
 * Direct import path used to optimize compilation speed.
 */

import { DashboardRoutePage } from '@/app/operations/dashboard/_shared/DashboardRoutePage';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';

export default async function DashboardRouteHandler() {
  return renderOperationsPage(
    '/clothing/operations/dashboard',
    <DashboardRoutePage />
  );
}
