import { MessageTemplatesRoutePage } from '@/app/operations/message-templates/_shared/MessageTemplatesRoutePage';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';
import { DEFAULT_MESSAGE_TEMPLATES } from '@/modules/clothing/operations/message-templates/templates.data';
import { getMessageTemplatesFromDb } from '@/modules/clothing/operations/message-templates/messageTemplates.service';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export default async function MessageTemplatesPage() {
  const modulePath = '/clothing/operations/message-templates';
  let templates = DEFAULT_MESSAGE_TEMPLATES;

  try {
    templates = await getMessageTemplatesFromDb();
  } catch (error) {
    logger.error('Failed to load message templates for operations page', error);
  }

  return renderOperationsPage(
    modulePath,
    <MessageTemplatesRoutePage
      templates={templates}
      addTemplateCtaHref="/clothing/operations/settings?tab=message&subTab=message-templates"
    />
  );
}
