import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';
import { EmployeesDashboard } from '@/app/clothing/employees/dashboard/page';

export default async function GeneralMerchandiseEmployeesDashboard() {
  const hasAccess = await hasModuleAccess(
    '/general-merchandise/employees/dashboard'
  );
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <EmployeesDashboard apiBasePath="/api/general-merchandise" />
    </PermissionGuard>
  );
}
