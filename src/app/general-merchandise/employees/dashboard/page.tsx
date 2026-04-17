import { EmployeesDashboard } from '@/app/clothing/employees/dashboard/page';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';

export default async function GeneralMerchandiseEmployeesDashboard() {
  return renderOperationsPage(
    '/general-merchandise/employees/dashboard',
    <EmployeesDashboard apiBasePath="/api/general-merchandise" />
  );
}
