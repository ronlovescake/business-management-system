import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';
import { EmployeesPayrollPage } from '@/app/clothing/employees/payroll/page';

export default async function GeneralMerchandiseEmployeesPayroll() {
  const hasAccess = await hasModuleAccess(
    '/general-merchandise/employees/payroll'
  );
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <EmployeesPayrollPage apiBasePath="/api/general-merchandise" />
    </PermissionGuard>
  );
}
