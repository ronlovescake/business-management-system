import { EmployeesCashAdvancePage } from '@/app/clothing/employees/cash-advance/page';
import { renderGmEmployeesPage } from '@/app/general-merchandise/employees/_shared/renderGmEmployeesPage';

export default async function GeneralMerchandiseEmployeesCashAdvance() {
  return renderGmEmployeesPage(
    '/general-merchandise/employees/cash-advance',
    <EmployeesCashAdvancePage apiBasePath="/api/general-merchandise" />
  );
}
