import { EmployeesSchedulesPage } from '@/app/clothing/employees/schedules/page';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';

export default async function GeneralMerchandiseEmployeesSchedules() {
  return renderOperationsPage(
    '/general-merchandise/employees/schedules',
    <EmployeesSchedulesPage apiBasePath="/api/general-merchandise" />
  );
}
