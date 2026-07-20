import { EmployeeNotificationsPage } from '@/app/employees/_shared/EmployeeNotificationsPage';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';

export default async function GeneralMerchandiseEmployeesNotifications() {
  return renderOperationsPage(
    '/general-merchandise/employees/notifications',
    <EmployeeNotificationsPage
      domains={[
        {
          label: 'General Merchandise',
          value: 'general-merchandise',
          apiBasePath: '/api/general-merchandise',
        },
      ]}
    />
  );
}
