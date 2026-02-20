import { renderGmOperationsPage } from '@/app/general-merchandise/operations/_shared/renderGmOperationsPage';
import { MessagingRoutePage } from '@/app/operations/messaging/_shared/MessagingRoutePage';

export default async function GeneralMerchandiseMessagingPage() {
  return renderGmOperationsPage(
    '/general-merchandise/operations/messaging',
    <MessagingRoutePage />
  );
}
