import { EmployeesLeaveTrackerPage } from '@/app/clothing/employees/leave-tracker/page';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';

export default async function GeneralMerchandiseEmployeesLeaveTracker() {
  return renderOperationsPage(
    '/general-merchandise/employees/leave-tracker',
    <EmployeesLeaveTrackerPage apiBasePath="/api/general-merchandise" />
  );
}
