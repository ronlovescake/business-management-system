import { PageLayout } from '@/components/layout/PageLayout';
import { MessageTemplatesBoard } from '@/app/clothing/operations/message-templates/MessageTemplatesBoard';
import { DEFAULT_MESSAGE_TEMPLATES } from '@/modules/clothing/operations/message-templates/templates.data';
import { logger } from '@/lib/logger';
import type { MessageTemplate } from '@/modules/clothing/operations/message-templates/types';
import { prisma } from '@/lib/db';
import { renderGmOperationsPage } from '@/app/general-merchandise/operations/_shared/renderGmOperationsPage';

export const dynamic = 'force-dynamic';

const gmPrisma = prisma as unknown as {
  generalMerchandiseMessageTemplate: typeof prisma.messageTemplate;
};

async function loadTemplates(): Promise<MessageTemplate[]> {
  try {
    const records = await gmPrisma.generalMerchandiseMessageTemplate.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const existing = records.map((record) => ({
      id: record.slug,
      title: record.title,
      badge: record.badge,
      paragraphs: Array.isArray(record.paragraphs)
        ? (record.paragraphs as string[])
        : [],
    }));

    const existingIds = new Set(existing.map((record) => record.id));
    const missingTemplates = DEFAULT_MESSAGE_TEMPLATES.filter(
      (template) => !existingIds.has(template.id)
    );

    if (missingTemplates.length > 0) {
      await gmPrisma.generalMerchandiseMessageTemplate.createMany({
        data: missingTemplates.map((template) => ({
          slug: template.id,
          title: template.title,
          badge: template.badge,
          paragraphs: template.paragraphs,
        })),
        skipDuplicates: true,
      });
    }

    if (existing.length === 0) {
      return DEFAULT_MESSAGE_TEMPLATES;
    }

    return [...existing, ...missingTemplates];
  } catch (error) {
    logger.error(
      'Failed to load GM message templates for operations page',
      error
    );
    return DEFAULT_MESSAGE_TEMPLATES;
  }
}

export default async function MessageTemplatesPage() {
  const modulePath = '/general-merchandise/operations/message-templates';
  const templates = await loadTemplates();

  return renderGmOperationsPage(
    modulePath,
    <PageLayout size="xl">
      <MessageTemplatesBoard
        templates={templates}
        showHeader={false}
        showUsageHint={false}
        addTemplateCtaHref="/general-merchandise/operations/settings?tab=message&subTab=message-templates"
      />
    </PageLayout>
  );
}
