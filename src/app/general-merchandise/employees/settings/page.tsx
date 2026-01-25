import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';
import { EmployeesSettingsPage } from '@/app/clothing/employees/settings/page';

export default async function GeneralMerchandiseEmployeesSettings() {
  const hasAccess = await hasModuleAccess(
    '/general-merchandise/employees/settings'
  );
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <EmployeesSettingsPage apiBasePath="/api/general-merchandise" />
    </PermissionGuard>
  );
}
