import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';
import { NotificationsRoutePage } from '@/app/operations/notifications/_shared/NotificationsRoutePage';

export default async function NotificationsPage() {
  return renderOperationsPage(
    '/clothing/operations/notifications',
    <NotificationsRoutePage />
  );
}
