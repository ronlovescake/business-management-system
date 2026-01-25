import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';
import EmployeeLoans from '@/app/clothing/employees/employee-loans/page';

export default async function GeneralMerchandiseEmployeesLoans() {
  const hasAccess = await hasModuleAccess(
    '/general-merchandise/employees/employee-loans'
  );
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <EmployeeLoans />
    </PermissionGuard>
  );
}
