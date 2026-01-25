import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';
import { EmployeesLeaveTrackerPage } from '@/app/clothing/employees/leave-tracker/page';

export default async function GeneralMerchandiseEmployeesLeaveTracker() {
  const hasAccess = await hasModuleAccess(
    '/general-merchandise/employees/leave-tracker'
  );
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <EmployeesLeaveTrackerPage apiBasePath="/api/general-merchandise" />
    </PermissionGuard>
  );
}
