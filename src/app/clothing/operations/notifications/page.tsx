import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';
import { NotificationsClientPage } from './NotificationsClientPage';

export default async function NotificationsPage() {
  const hasAccess = await hasModuleAccess('/clothing/operations/notifications');
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <NotificationsClientPage />
    </PermissionGuard>
  );
}
