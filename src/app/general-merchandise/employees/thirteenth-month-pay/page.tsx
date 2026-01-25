import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';
import { EmployeesThirteenthMonthPayPage } from '@/app/clothing/employees/thirteenth-month-pay/page';

export default async function GeneralMerchandiseEmployeesThirteenthMonthPay() {
  const hasAccess = await hasModuleAccess(
    '/general-merchandise/employees/thirteenth-month-pay'
  );
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <EmployeesThirteenthMonthPayPage apiBasePath="/api/general-merchandise" />
    </PermissionGuard>
  );
}
