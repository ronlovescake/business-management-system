import { EmployeeDetailPage } from '@/app/clothing/employees/team/[id]/page';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';

export default async function GeneralMerchandiseEmployeeDetailPage() {
  return renderOperationsPage(
    '/general-merchandise/employees/team',
    <EmployeeDetailPage
      apiBasePath="/api/general-merchandise"
      businessPath="/general-merchandise"
    />
  );
}
