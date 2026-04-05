import { EmployeeAutomationSettingsPage } from '@/app/employees/_shared/EmployeeAutomationSettingsPage';
import { renderGmEmployeesPage } from '@/app/general-merchandise/employees/_shared/renderGmEmployeesPage';

export default async function GeneralMerchandiseEmployeesSettings() {
  return renderGmEmployeesPage(
    '/general-merchandise/employees/settings',
    <EmployeeAutomationSettingsPage apiBasePath="/api/general-merchandise" />
  );
}
