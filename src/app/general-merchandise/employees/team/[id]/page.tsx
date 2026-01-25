import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';
import { EmployeeDetailPage } from '@/app/clothing/employees/team/[id]/page';

export default async function GeneralMerchandiseEmployeeDetailPage() {
  const hasAccess = await hasModuleAccess(
    '/general-merchandise/employees/team'
  );
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <EmployeeDetailPage
        apiBasePath="/api/general-merchandise"
        businessPath="/general-merchandise"
      />
    </PermissionGuard>
  );
}
