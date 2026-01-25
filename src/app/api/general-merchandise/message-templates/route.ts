import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  DEFAULT_MESSAGE_TEMPLATES,
  MESSAGE_TEMPLATE_TITLE_ORDER,
} from '@/modules/clothing/operations/message-templates/templates.data';
import type { MessageTemplate } from '@/modules/clothing/operations/message-templates/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'default-no-store';

const gmPrisma = prisma as unknown as {
  generalMerchandiseMessageTemplate: typeof prisma.messageTemplate;
};

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

async function getMessageTemplatesFromDb(): Promise<MessageTemplate[]> {
  const records = await gmPrisma.generalMerchandiseMessageTemplate.findMany({
    orderBy: { createdAt: 'asc' },
  });

  if (records.length > 0) {
    return sortTemplatesByPreferredOrder(records.map(mapRecordToTemplate));
  }

  // Seed defaults when table is empty
  await gmPrisma.generalMerchandiseMessageTemplate.createMany({
    data: DEFAULT_MESSAGE_TEMPLATES.map((template) => ({
      slug: template.id,
      title: template.title,
      badge: template.badge,
      paragraphs: template.paragraphs,
    })),
  });

  return sortTemplatesByPreferredOrder(DEFAULT_MESSAGE_TEMPLATES);
}

async function upsertMessageTemplate(payload: MessageTemplate) {
  const record = await gmPrisma.generalMerchandiseMessageTemplate.upsert({
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
    const existing =
      await gmPrisma.generalMerchandiseMessageTemplate.findUnique({
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

  const record = await gmPrisma.generalMerchandiseMessageTemplate.create({
    data: {
      slug,
      title: payload.title,
      badge: payload.badge,
      paragraphs: payload.paragraphs,
    },
  });

  return mapRecordToTemplate(record);
}

export async function GET() {
  try {
    const templates = await getMessageTemplatesFromDb();
    return NextResponse.json({ success: true, data: templates });
  } catch (error) {
    logger.error('Failed to load GM message templates', error);
    return NextResponse.json(
      { error: 'Failed to load message templates' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, title, badge, paragraphs } = body ?? {};

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: 'Template id is required' },
        { status: 400 }
      );
    }

    if (!title || typeof title !== 'string') {
      return NextResponse.json(
        { error: 'Template title is required' },
        { status: 400 }
      );
    }

    if (!badge || typeof badge !== 'string') {
      return NextResponse.json(
        { error: 'Badge label is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(paragraphs)) {
      return NextResponse.json(
        { error: 'Paragraphs array is required' },
        { status: 400 }
      );
    }

    const sanitizedParagraphs = paragraphs
      .map((paragraph: unknown) =>
        typeof paragraph === 'string' ? paragraph.trim() : ''
      )
      .filter(Boolean);

    if (sanitizedParagraphs.length === 0) {
      return NextResponse.json(
        { error: 'Template must include at least one paragraph' },
        { status: 400 }
      );
    }

    const template = await upsertMessageTemplate({
      id,
      title: title.trim(),
      badge: badge.trim(),
      paragraphs: sanitizedParagraphs,
    });

    return NextResponse.json({ success: true, data: template });
  } catch (error) {
    logger.error('Failed to update GM template', error);
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, badge, paragraphs } = body ?? {};

    if (!title || typeof title !== 'string') {
      return NextResponse.json(
        { error: 'Template title is required' },
        { status: 400 }
      );
    }

    if (!badge || typeof badge !== 'string') {
      return NextResponse.json(
        { error: 'Badge label is required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(paragraphs)) {
      return NextResponse.json(
        { error: 'Paragraphs array is required' },
        { status: 400 }
      );
    }

    const sanitizedParagraphs = paragraphs
      .map((paragraph: unknown) =>
        typeof paragraph === 'string' ? paragraph.trim() : ''
      )
      .filter(Boolean);

    if (sanitizedParagraphs.length === 0) {
      return NextResponse.json(
        { error: 'Template must include at least one paragraph' },
        { status: 400 }
      );
    }

    const template = await createMessageTemplate({
      title: title.trim(),
      badge: badge.trim(),
      paragraphs: sanitizedParagraphs,
    });

    return NextResponse.json(
      { success: true, data: template },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Failed to create GM template', error);
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }
}
