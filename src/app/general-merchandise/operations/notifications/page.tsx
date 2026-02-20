import { NotificationsRoutePage } from '@/app/operations/notifications/_shared/NotificationsRoutePage';
import { renderGmOperationsPage } from '@/app/general-merchandise/operations/_shared/renderGmOperationsPage';

export default async function NotificationsPage() {
  return renderGmOperationsPage(
    '/general-merchandise/operations/notifications',
    <NotificationsRoutePage apiBasePath="/api/general-merchandise" />
  );
}
