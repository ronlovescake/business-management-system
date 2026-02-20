import { EmployeesSchedulesPage } from '@/app/clothing/employees/schedules/page';
import { renderGmEmployeesPage } from '@/app/general-merchandise/employees/_shared/renderGmEmployeesPage';

export default async function GeneralMerchandiseEmployeesSchedules() {
  return renderGmEmployeesPage(
    '/general-merchandise/employees/schedules',
    <EmployeesSchedulesPage apiBasePath="/api/general-merchandise" />
  );
}
