import { NotificationsClientPage } from '@/app/clothing/operations/notifications/NotificationsClientPage';
import { renderGmOperationsPage } from '@/app/general-merchandise/operations/_shared/renderGmOperationsPage';

export default async function NotificationsPage() {
  return renderGmOperationsPage(
    '/general-merchandise/operations/notifications',
    <NotificationsClientPage apiBasePath="/api/general-merchandise" />
  );
}
