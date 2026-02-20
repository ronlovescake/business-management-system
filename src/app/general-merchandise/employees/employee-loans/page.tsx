import EmployeeLoans from '@/app/clothing/employees/employee-loans/page';
import { renderGmEmployeesPage } from '@/app/general-merchandise/employees/_shared/renderGmEmployeesPage';

export default async function GeneralMerchandiseEmployeesLoans() {
  return renderGmEmployeesPage(
    '/general-merchandise/employees/employee-loans',
    <EmployeeLoans />
  );
}
