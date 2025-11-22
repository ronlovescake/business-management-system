import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { PageLayout } from '@/components/layout/PageLayout';
import { MessageTemplatesBoard } from './MessageTemplatesBoard';
import {
  getFirstAccessibleModule,
  hasModuleAccess,
} from '@/lib/auth/permissions';
import { DEFAULT_MESSAGE_TEMPLATES } from '@/modules/clothing/operations/message-templates/templates.data';
import { getMessageTemplatesFromDb } from '@/modules/clothing/operations/message-templates/messageTemplates.service';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export default async function MessageTemplatesPage() {
  const modulePath = '/clothing/operations/message-templates';
  const hasAccess = await hasModuleAccess(modulePath);
  const redirectTo = await getFirstAccessibleModule();
  let templates = DEFAULT_MESSAGE_TEMPLATES;

  try {
    templates = await getMessageTemplatesFromDb();
  } catch (error) {
    logger.error('Failed to load message templates for operations page', error);
  }

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <PageLayout size="xl">
        <MessageTemplatesBoard
          templates={templates}
          showHeader={false}
          addTemplateCtaHref="/clothing/operations/settings?tab=message&subTab=message-templates"
        />
      </PageLayout>
    </PermissionGuard>
  );
}
