import { EmployeesThirteenthMonthPayPage } from '@/app/clothing/employees/thirteenth-month-pay/page';
import { renderGmEmployeesPage } from '@/app/general-merchandise/employees/_shared/renderGmEmployeesPage';

export default async function GeneralMerchandiseEmployeesThirteenthMonthPay() {
  return renderGmEmployeesPage(
    '/general-merchandise/employees/thirteenth-month-pay',
    <EmployeesThirteenthMonthPayPage apiBasePath="/api/general-merchandise" />
  );
}
