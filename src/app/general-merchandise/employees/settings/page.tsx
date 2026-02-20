import { EmployeesSettingsPage } from '@/app/clothing/employees/settings/page';
import { renderGmEmployeesPage } from '@/app/general-merchandise/employees/_shared/renderGmEmployeesPage';

export default async function GeneralMerchandiseEmployeesSettings() {
  return renderGmEmployeesPage(
    '/general-merchandise/employees/settings',
    <EmployeesSettingsPage apiBasePath="/api/general-merchandise" />
  );
}
