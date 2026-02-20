import { EmployeesAttendancePage } from '@/app/clothing/employees/attendance/page';
import { renderGmEmployeesPage } from '@/app/general-merchandise/employees/_shared/renderGmEmployeesPage';

export default async function GeneralMerchandiseEmployeesAttendance() {
  return renderGmEmployeesPage(
    '/general-merchandise/employees/attendance',
    <EmployeesAttendancePage apiBasePath="/api/general-merchandise" />
  );
}
