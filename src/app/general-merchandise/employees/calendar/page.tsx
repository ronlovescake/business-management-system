import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';
import Calendar from '@/app/clothing/employees/calendar/page';

export default async function GeneralMerchandiseEmployeesCalendar() {
  const hasAccess = await hasModuleAccess(
    '/general-merchandise/employees/calendar'
  );
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <Calendar />
    </PermissionGuard>
  );
}
