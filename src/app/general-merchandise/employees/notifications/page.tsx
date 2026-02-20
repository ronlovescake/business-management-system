import EmployeeNotifications from '@/app/clothing/employees/notifications/page';
import { renderGmEmployeesPage } from '@/app/general-merchandise/employees/_shared/renderGmEmployeesPage';

export default async function GeneralMerchandiseEmployeesNotifications() {
  return renderGmEmployeesPage(
    '/general-merchandise/employees/notifications',
    <EmployeeNotifications />
  );
}
