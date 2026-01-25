import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';
import EmployeeNotifications from '@/app/clothing/employees/notifications/page';

export default async function GeneralMerchandiseEmployeesNotifications() {
  const hasAccess = await hasModuleAccess(
    '/general-merchandise/employees/notifications'
  );
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <EmployeeNotifications />
    </PermissionGuard>
  );
}
