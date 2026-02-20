import { DashboardPage } from '@/modules/clothing/operations/dashboard/components/DashboardPage';
import { DashboardErrorBoundary } from '@/app/clothing/operations/dashboard/components/DashboardErrorBoundary';

export function DashboardRoutePage() {
  return (
    <DashboardErrorBoundary>
      <DashboardPage />
    </DashboardErrorBoundary>
  );
}
