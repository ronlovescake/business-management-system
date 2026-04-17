import { EmployeesTeamPage } from '@/app/clothing/employees/team/page';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';

export default async function GeneralMerchandiseEmployeesTeam() {
  return renderOperationsPage(
    '/general-merchandise/employees/team',
    <EmployeesTeamPage
      apiBasePath="/api/general-merchandise"
      businessPath="/general-merchandise"
    />
  );
}
