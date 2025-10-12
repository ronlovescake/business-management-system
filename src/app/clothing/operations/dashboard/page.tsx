/**
 * Dashboard Route Handler
 *
 * This file now simply delegates to the modular DashboardPage component.
 * All business logic has been extracted to the module structure.
 */

import { DashboardPage } from '@/modules/clothing/operations/dashboard';

export default function DashboardRouteHandler() {
  return <DashboardPage />;
}
