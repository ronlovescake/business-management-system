/**
 * Dashboard Route Handler
 *
 * This file now simply delegates to the modular DashboardPage component.
 * All business logic has been extracted to the module structure.
 * Direct import path used to optimize compilation speed.
 */

import { DashboardPage } from '@/modules/clothing/operations/dashboard/components/DashboardPage';
import { DashboardErrorBoundary } from './components/DashboardErrorBoundary';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';

export default async function DashboardRouteHandler() {
  const hasAccess = await hasModuleAccess('/clothing/operations/dashboard');
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <DashboardErrorBoundary>
        <DashboardPage />
      </DashboardErrorBoundary>
    </PermissionGuard>
  );
}
