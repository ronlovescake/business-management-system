import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';
import { MessagingRoutePage } from '@/app/operations/messaging/_shared/MessagingRoutePage';

export default async function MessagingPage() {
  return renderOperationsPage(
    '/clothing/operations/messaging',
    <MessagingRoutePage />
  );
}
