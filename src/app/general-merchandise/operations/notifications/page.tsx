import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';
import { NotificationsClientPage } from '@/app/clothing/operations/notifications/NotificationsClientPage';

export default async function NotificationsPage() {
  const hasAccess = await hasModuleAccess(
    '/general-merchandise/operations/notifications'
  );
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <NotificationsClientPage apiBasePath="/api/general-merchandise" />
    </PermissionGuard>
  );
}
