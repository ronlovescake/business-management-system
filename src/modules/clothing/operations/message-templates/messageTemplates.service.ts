import { prisma } from '@/lib/db';
import { DEFAULT_MESSAGE_TEMPLATES } from './templates.data';
import type { MessageTemplate } from './types';

function mapRecordToTemplate(record: {
  slug: string;
  title: string;
  badge: string;
  paragraphs: unknown;
}): MessageTemplate {
  const paragraphs = Array.isArray(record.paragraphs)
    ? (record.paragraphs as string[])
    : [];

  return {
    id: record.slug,
    title: record.title,
    badge: record.badge,
    paragraphs,
  };
}

export async function getMessageTemplatesFromDb(): Promise<MessageTemplate[]> {
  const records = await prisma.messageTemplate.findMany({
    orderBy: { createdAt: 'asc' },
  });

  if (records.length > 0) {
    return records.map(mapRecordToTemplate);
  }

  // Seed defaults when table is empty
  await prisma.messageTemplate.createMany({
    data: DEFAULT_MESSAGE_TEMPLATES.map((template) => ({
      slug: template.id,
      title: template.title,
      badge: template.badge,
      paragraphs: template.paragraphs,
    })),
  });

  return DEFAULT_MESSAGE_TEMPLATES;
}

export async function upsertMessageTemplate(payload: MessageTemplate) {
  const record = await prisma.messageTemplate.upsert({
    where: { slug: payload.id },
    update: {
      title: payload.title,
      badge: payload.badge,
      paragraphs: payload.paragraphs,
    },
    create: {
      slug: payload.id,
      title: payload.title,
      badge: payload.badge,
      paragraphs: payload.paragraphs,
    },
  });

  return mapRecordToTemplate(record);
}
