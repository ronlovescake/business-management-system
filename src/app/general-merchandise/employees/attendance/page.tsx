import { EmployeesAttendancePage } from '@/app/clothing/employees/attendance/page';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';

export default async function GeneralMerchandiseEmployeesAttendance() {
  return renderOperationsPage(
    '/general-merchandise/employees/attendance',
    <EmployeesAttendancePage apiBasePath="/api/general-merchandise" />
  );
}
