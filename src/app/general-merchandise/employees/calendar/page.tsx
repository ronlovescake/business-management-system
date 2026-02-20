import Calendar from '@/app/clothing/employees/calendar/page';
import { renderGmEmployeesPage } from '@/app/general-merchandise/employees/_shared/renderGmEmployeesPage';

export default async function GeneralMerchandiseEmployeesCalendar() {
  return renderGmEmployeesPage(
    '/general-merchandise/employees/calendar',
    <Calendar />
  );
}
