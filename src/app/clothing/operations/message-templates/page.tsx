import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { PageLayout } from '@/components/layout/PageLayout';
import {
  MessageTemplatesBoard,
  type MessageTemplate,
} from './MessageTemplatesBoard';
import {
  getFirstAccessibleModule,
  hasModuleAccess,
} from '@/lib/auth/permissions';

export default async function MessageTemplatesPage() {
  const modulePath = '/clothing/operations/message-templates';
  const hasAccess = await hasModuleAccess(modulePath);
  const redirectTo = await getFirstAccessibleModule();

  const templates: MessageTemplate[] = [
    {
      title: 'Payment Reminders',
      badge: 'Reminder',
      paragraphs: [
        'Dear Customer,',
        'This is a gentle reminder regarding your pending transaction with us. Our records indicate that payment has not yet been completed and we understand this may have simply slipped your mind.',
        'To avoid cancellation of your transaction, please ensure that full payment and all necessary requirements are completed within 3 days.',
        'If you have already settled this or believe you have received this message in error, please disregard this notice.',
        'Thank you for your prompt attention and continued support.',
        'Warm regards,',
        'Czarlie & Ron',
      ],
    },
    {
      title: 'Cancellation: Without Reservation Fee',
      badge: 'Cancellation',
      paragraphs: [
        'Dear Customer,',
        'We regret to inform you that your recent transaction has been canceled as it was not completed within timeframe.',
        'To prevent this from happening again, please ensure that all transactions are completed within 3 days.',
        'Thank you for your understanding and continued support.',
        'Warm regards,',
        'Czarlie & Ron',
      ],
    },
    {
      title: 'Cancellation: With Reservation Fee',
      badge: 'Cancellation',
      paragraphs: [
        'Dear Customer,',
        'We regret to inform you that your recent transaction has been canceled because, despite payment of the reservation fee, the transaction was not completed within the specified timeframe.',
        'As stated in our terms, the reservation fee is non-refundable and will be forfeited due to the transaction not being completed within 3 days.',
        'To prevent this from happening again, please ensure that all future transactions are fully completed within 3 days.',
        'Thank you for your understanding and continued support.',
        'Warm regards,',
        'Czarlie & Ron',
      ],
    },
  ];

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <PageLayout title="Message Templates" size="xl">
        <MessageTemplatesBoard templates={templates} />
      </PageLayout>
    </PermissionGuard>
  );
}
