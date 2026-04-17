import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';
import { MessagingRoutePage } from '@/app/operations/messaging/_shared/MessagingRoutePage';

export default async function GeneralMerchandiseMessagingPage() {
  return renderOperationsPage(
    '/general-merchandise/operations/messaging',
    <MessagingRoutePage />
  );
}
