import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';
import { EmployeesAttendancePage } from '@/app/clothing/employees/attendance/page';

export default async function GeneralMerchandiseEmployeesAttendance() {
  const hasAccess = await hasModuleAccess(
    '/general-merchandise/employees/attendance'
  );
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <EmployeesAttendancePage apiBasePath="/api/general-merchandise" />
    </PermissionGuard>
  );
}
