import { EmployeesTeamPage } from '@/app/clothing/employees/team/page';
import { renderGmEmployeesPage } from '@/app/general-merchandise/employees/_shared/renderGmEmployeesPage';

export default async function GeneralMerchandiseEmployeesTeam() {
  return renderGmEmployeesPage(
    '/general-merchandise/employees/team',
    <EmployeesTeamPage
      apiBasePath="/api/general-merchandise"
      businessPath="/general-merchandise"
    />
  );
}
