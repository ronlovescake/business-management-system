import { PageLayout } from '@/components/layout/PageLayout';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { ChangeLogPage } from '@/modules/admin/change-log';
import { getFirstAccessibleModule } from '@/lib/auth/permissions';
import { isAdmin } from '@/lib/auth/session';

export default async function AdminChangeLogPage() {
  const [hasAccess, redirectTo] = await Promise.all([
    isAdmin(),
    getFirstAccessibleModule(),
  ]);

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <PageLayout fluid withPadding>
        <ChangeLogPage />
      </PageLayout>
    </PermissionGuard>
  );
}
