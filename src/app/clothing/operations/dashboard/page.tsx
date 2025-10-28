/**
 * Dashboard Route Handler
 *
 * This file now simply delegates to the modular DashboardPage component.
 * All business logic has been extracted to the module structure.
 * Direct import path used to optimize compilation speed.
 */

import { DashboardPage } from '@/modules/clothing/operations/dashboard/components/DashboardPage'
import { DashboardErrorBoundary } from './components/DashboardErrorBoundary';;

export default function DashboardRouteHandler() {
  return (
    <DashboardErrorBoundary>
      <DashboardPage />
    </DashboardErrorBoundary>
  );;
}
