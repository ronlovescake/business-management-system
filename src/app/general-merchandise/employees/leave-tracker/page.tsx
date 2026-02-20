import { EmployeesLeaveTrackerPage } from '@/app/clothing/employees/leave-tracker/page';
import { renderGmEmployeesPage } from '@/app/general-merchandise/employees/_shared/renderGmEmployeesPage';

export default async function GeneralMerchandiseEmployeesLeaveTracker() {
  return renderGmEmployeesPage(
    '/general-merchandise/employees/leave-tracker',
    <EmployeesLeaveTrackerPage apiBasePath="/api/general-merchandise" />
  );
}
