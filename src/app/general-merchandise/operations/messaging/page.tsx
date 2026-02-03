import { MessagingClientPage } from '@/app/clothing/operations/messaging/MessagingClientPage';
import { renderGmOperationsPage } from '@/app/general-merchandise/operations/_shared/renderGmOperationsPage';

export default async function GeneralMerchandiseMessagingPage() {
  return renderGmOperationsPage(
    '/general-merchandise/operations/messaging',
    <MessagingClientPage />
  );
}
