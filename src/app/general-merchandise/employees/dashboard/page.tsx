import { EmployeesDashboard } from '@/app/clothing/employees/dashboard/page';
import { renderGmEmployeesPage } from '@/app/general-merchandise/employees/_shared/renderGmEmployeesPage';

export default async function GeneralMerchandiseEmployeesDashboard() {
  return renderGmEmployeesPage(
    '/general-merchandise/employees/dashboard',
    <EmployeesDashboard apiBasePath="/api/general-merchandise" />
  );
}
