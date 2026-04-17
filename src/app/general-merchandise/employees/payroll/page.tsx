import { EmployeesPayrollPage } from '@/app/clothing/employees/payroll/page';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';

export default async function GeneralMerchandiseEmployeesPayroll() {
  return renderOperationsPage(
    '/general-merchandise/employees/payroll',
    <EmployeesPayrollPage apiBasePath="/api/general-merchandise" />
  );
}
