import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';
import { EmployeesCashAdvancePage } from '@/app/clothing/employees/cash-advance/page';

export default async function GeneralMerchandiseEmployeesCashAdvance() {
  const hasAccess = await hasModuleAccess(
    '/general-merchandise/employees/cash-advance'
  );
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <EmployeesCashAdvancePage apiBasePath="/api/general-merchandise" />
    </PermissionGuard>
  );
}
