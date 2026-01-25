import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';
import { MessagingClientPage } from '@/app/clothing/operations/messaging/MessagingClientPage';

export default async function GeneralMerchandiseMessagingPage() {
  const hasAccess = await hasModuleAccess(
    '/general-merchandise/operations/messaging'
  );
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <MessagingClientPage />
    </PermissionGuard>
  );
}
