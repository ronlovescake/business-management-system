import { EmployeeDetailPage } from '@/app/clothing/employees/team/[id]/page';
import { renderGmEmployeesPage } from '@/app/general-merchandise/employees/_shared/renderGmEmployeesPage';

export default async function GeneralMerchandiseEmployeeDetailPage() {
  return renderGmEmployeesPage(
    '/general-merchandise/employees/team',
    <EmployeeDetailPage
      apiBasePath="/api/general-merchandise"
      businessPath="/general-merchandise"
    />
  );
}
