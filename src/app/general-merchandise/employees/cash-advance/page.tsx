import { EmployeesCashAdvancePage } from '@/app/clothing/employees/cash-advance/page';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';

export default async function GeneralMerchandiseEmployeesCashAdvance() {
  return renderOperationsPage(
    '/general-merchandise/employees/cash-advance',
    <EmployeesCashAdvancePage apiBasePath="/api/general-merchandise" />
  );
}
