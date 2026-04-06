import type { MessageTemplate } from '@/modules/clothing/operations/message-templates/types';
import {
  DEFAULT_MESSAGE_TEMPLATES,
  MESSAGE_TEMPLATE_TITLE_ORDER,
} from '@/modules/clothing/operations/message-templates/templates.data';

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

/**
 * Prisma delegate for the message-template model.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface MessageTemplateModelDelegate {
  findMany: (
    args: any
  ) => Promise<
    Array<{ slug: string; title: string; badge: string; paragraphs: unknown }>
  >;
  findUnique: (args: any) => Promise<{ id: string } | null>;
  createMany: (args: any) => Promise<unknown>;
  create: (args: any) => Promise<{
    slug: string;
    title: string;
    badge: string;
    paragraphs: unknown;
  }>;
  upsert: (args: any) => Promise<{
    slug: string;
    title: string;
    badge: string;
    paragraphs: unknown;
  }>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function createMessageTemplateService(
  model: MessageTemplateModelDelegate
) {
  async function getMessageTemplatesFromDb(): Promise<MessageTemplate[]> {
    const records = await model.findMany({
      orderBy: { createdAt: 'asc' },
    });

    if (records.length > 0) {
      return sortTemplatesByPreferredOrder(records.map(mapRecordToTemplate));
    }

    await model.createMany({
      data: DEFAULT_MESSAGE_TEMPLATES.map((template) => ({
        slug: template.id,
        title: template.title,
        badge: template.badge,
        paragraphs: template.paragraphs,
      })),
    });

    return sortTemplatesByPreferredOrder(DEFAULT_MESSAGE_TEMPLATES);
  }

  async function upsertMessageTemplate(
    payload: MessageTemplate
  ): Promise<MessageTemplate> {
    const record = await model.upsert({
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
      const existing = await model.findUnique({
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

  async function createMessageTemplate(
    payload: Omit<MessageTemplate, 'id'>
  ): Promise<MessageTemplate> {
    const baseSlug = slugifyTitle(payload.title);
    const slug = await generateUniqueSlug(baseSlug);

    const record = await model.create({
      data: {
        slug,
        title: payload.title,
        badge: payload.badge,
        paragraphs: payload.paragraphs,
      },
    });

    return mapRecordToTemplate(record);
  }

  return {
    getMessageTemplatesFromDb,
    upsertMessageTemplate,
    createMessageTemplate,
  };
}
