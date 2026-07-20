import { EmployeeNotificationsPage } from '@/app/employees/_shared/EmployeeNotificationsPage';

export default function EmployeeNotifications() {
  return (
    <EmployeeNotificationsPage
      domains={[
        { label: 'Trucking', value: 'trucking', apiBasePath: '/api/trucking' },
      ]}
    />
  );
}
