import { EmployeeAutomationSettingsPage } from '@/app/employees/_shared/EmployeeAutomationSettingsPage';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';

export default async function GeneralMerchandiseEmployeesSettings() {
  return renderOperationsPage(
    '/general-merchandise/employees/settings',
    <EmployeeAutomationSettingsPage apiBasePath="/api/general-merchandise" />
  );
}
