import { EmployeesPayrollPage } from '@/app/clothing/employees/payroll/page';
import { renderGmEmployeesPage } from '@/app/general-merchandise/employees/_shared/renderGmEmployeesPage';

export default async function GeneralMerchandiseEmployeesPayroll() {
  return renderGmEmployeesPage(
    '/general-merchandise/employees/payroll',
    <EmployeesPayrollPage apiBasePath="/api/general-merchandise" />
  );
}
