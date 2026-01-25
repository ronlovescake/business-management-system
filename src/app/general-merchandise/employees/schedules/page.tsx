import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';
import { EmployeesSchedulesPage } from '@/app/clothing/employees/schedules/page';

export default async function GeneralMerchandiseEmployeesSchedules() {
  const hasAccess = await hasModuleAccess(
    '/general-merchandise/employees/schedules'
  );
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <EmployeesSchedulesPage apiBasePath="/api/general-merchandise" />
    </PermissionGuard>
  );
}
