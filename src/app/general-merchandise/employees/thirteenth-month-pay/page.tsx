import { EmployeesThirteenthMonthPayPage } from '@/app/clothing/employees/thirteenth-month-pay/page';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';

export default async function GeneralMerchandiseEmployeesThirteenthMonthPay() {
  return renderOperationsPage(
    '/general-merchandise/employees/thirteenth-month-pay',
    <EmployeesThirteenthMonthPayPage apiBasePath="/api/general-merchandise" />
  );
}
