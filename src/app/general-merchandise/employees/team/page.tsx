import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';
import { EmployeesTeamPage } from '@/app/clothing/employees/team/page';

export default async function GeneralMerchandiseEmployeesTeam() {
  const hasAccess = await hasModuleAccess(
    '/general-merchandise/employees/team'
  );
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <EmployeesTeamPage apiBasePath="/api/general-merchandise" />
    </PermissionGuard>
  );
}
