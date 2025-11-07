import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';
import { MessagingClientPage } from './MessagingClientPage';

export default async function MessagingPage() {
  const hasAccess = await hasModuleAccess('/clothing/operations/messaging');
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <MessagingClientPage />
    </PermissionGuard>
  );
}
