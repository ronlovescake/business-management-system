import { prisma } from '@/lib/db';
import { DEFAULT_POST_TEMPLATE_NOTICE } from './notice.data';
import type { PostTemplateNotice } from './notice.types';

const NOTICE_SLUG = 'post-template-notice';

function mapRecordToNotice(record: {
  slug: string;
  introParagraphs: unknown;
  bulletPoints: unknown;
  id: string;
}): PostTemplateNotice {
  const introParagraphs = Array.isArray(record.introParagraphs)
    ? (record.introParagraphs as string[])
    : [];
  const bulletPoints = Array.isArray(record.bulletPoints)
    ? (record.bulletPoints as string[])
    : [];

  return {
    id: record.slug,
    introParagraphs,
    bulletPoints,
  };
}

export async function getPostTemplateNotice(): Promise<PostTemplateNotice> {
  const existing = await prisma.postTemplateNotice.findUnique({
    where: { slug: NOTICE_SLUG },
  });

  if (existing) {
    return mapRecordToNotice(existing);
  }

  const created = await prisma.postTemplateNotice.create({
    data: {
      slug: NOTICE_SLUG,
      introParagraphs: DEFAULT_POST_TEMPLATE_NOTICE.introParagraphs,
      bulletPoints: DEFAULT_POST_TEMPLATE_NOTICE.bulletPoints,
    },
  });

  return mapRecordToNotice(created);
}

export async function upsertPostTemplateNotice(
  payload: Omit<PostTemplateNotice, 'id'>
): Promise<PostTemplateNotice> {
  const record = await prisma.postTemplateNotice.upsert({
    where: { slug: NOTICE_SLUG },
    update: {
      introParagraphs: payload.introParagraphs,
      bulletPoints: payload.bulletPoints,
    },
    create: {
      slug: NOTICE_SLUG,
      introParagraphs: payload.introParagraphs,
      bulletPoints: payload.bulletPoints,
    },
  });

  return mapRecordToNotice(record);
}
