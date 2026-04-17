import Calendar from '@/app/clothing/employees/calendar/page';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';

export default async function GeneralMerchandiseEmployeesCalendar() {
  return renderOperationsPage(
    '/general-merchandise/employees/calendar',
    <Calendar />
  );
}
