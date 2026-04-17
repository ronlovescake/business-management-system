import { NotificationsRoutePage } from '@/app/operations/notifications/_shared/NotificationsRoutePage';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';

export default async function NotificationsPage() {
  return renderOperationsPage(
    '/general-merchandise/operations/notifications',
    <NotificationsRoutePage apiBasePath="/api/general-merchandise" />
  );
}
