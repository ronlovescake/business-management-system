import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';
import { PageLayout } from '@/components/layout/PageLayout';
import { DueDatesPage } from '@/modules/clothing/operations/due-dates/components/DueDatesPage';
import { DueDatesErrorBoundary } from '@/app/clothing/operations/due-dates/components/DueDatesErrorBoundary';

export default async function GeneralMerchandiseDueDatesPage() {
  const hasAccess = await hasModuleAccess(
    '/general-merchandise/operations/due-dates'
  );
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <PageLayout fluid withPadding>
        <DueDatesErrorBoundary>
          <DueDatesPage apiBasePath="/api/general-merchandise" />
        </DueDatesErrorBoundary>
      </PageLayout>
    </PermissionGuard>
  );
}
