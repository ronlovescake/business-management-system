import { prisma } from '@/lib/db';
import {
  DEFAULT_MESSAGE_TEMPLATES,
  MESSAGE_TEMPLATE_TITLE_ORDER,
} from './templates.data';
import type { MessageTemplate } from './types';

const TEMPLATE_TITLE_ORDER_LOOKUP = new Map<string, number>(
  MESSAGE_TEMPLATE_TITLE_ORDER.map((title, index) => [
    title.toLowerCase(),
    index,
  ])
);

function sortTemplatesByPreferredOrder(
  templates: MessageTemplate[]
): MessageTemplate[] {
  if (TEMPLATE_TITLE_ORDER_LOOKUP.size === 0) {
    return templates;
  }

  return [...templates].sort((a, b) => {
    const aOrder = TEMPLATE_TITLE_ORDER_LOOKUP.get(a.title.toLowerCase());
    const bOrder = TEMPLATE_TITLE_ORDER_LOOKUP.get(b.title.toLowerCase());

    if (aOrder !== undefined && bOrder !== undefined) {
      return aOrder - bOrder;
    }

    if (aOrder !== undefined) {
      return -1;
    }

    if (bOrder !== undefined) {
      return 1;
    }

    return a.title.localeCompare(b.title);
  });
}

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
    return sortTemplatesByPreferredOrder(records.map(mapRecordToTemplate));
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

  return sortTemplatesByPreferredOrder(DEFAULT_MESSAGE_TEMPLATES);
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

const FALLBACK_SLUG = 'message-template';

function slugifyTitle(input: string): string {
  const normalized = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

  return normalized.length > 0 ? normalized : FALLBACK_SLUG;
}

async function generateUniqueSlug(base: string): Promise<string> {
  let attempt = 0;
  let candidate = base;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.messageTemplate.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }

    attempt += 1;
    candidate = `${base}-${attempt}`;
  }
}

export async function createMessageTemplate(
  payload: Omit<MessageTemplate, 'id'>
): Promise<MessageTemplate> {
  const baseSlug = slugifyTitle(payload.title);
  const slug = await generateUniqueSlug(baseSlug);

  const record = await prisma.messageTemplate.create({
    data: {
      slug,
      title: payload.title,
      badge: payload.badge,
      paragraphs: payload.paragraphs,
    },
  });

  return mapRecordToTemplate(record);
}
