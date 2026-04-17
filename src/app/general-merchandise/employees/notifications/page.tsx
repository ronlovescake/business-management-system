import EmployeeNotifications from '@/app/clothing/employees/notifications/page';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';

export default async function GeneralMerchandiseEmployeesNotifications() {
  return renderOperationsPage(
    '/general-merchandise/employees/notifications',
    <EmployeeNotifications />
  );
}
