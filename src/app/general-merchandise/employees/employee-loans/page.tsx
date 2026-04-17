import EmployeeLoans from '@/app/clothing/employees/employee-loans/page';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';

export default async function GeneralMerchandiseEmployeesLoans() {
  return renderOperationsPage(
    '/general-merchandise/employees/employee-loans',
    <EmployeeLoans />
  );
}
