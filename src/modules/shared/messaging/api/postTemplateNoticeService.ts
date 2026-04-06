import { DEFAULT_POST_TEMPLATE_NOTICE } from '@/modules/clothing/operations/post-template/notice.data';
import type { PostTemplateNotice } from '@/modules/clothing/operations/post-template/notice.types';

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

/**
 * Prisma delegate for the post-template-notice model.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface PostTemplateNoticeModelDelegate {
  findUnique: (args: any) => Promise<{
    slug: string;
    introParagraphs: unknown;
    bulletPoints: unknown;
    id: string;
  } | null>;
  create: (args: any) => Promise<{
    slug: string;
    introParagraphs: unknown;
    bulletPoints: unknown;
    id: string;
  }>;
  upsert: (args: any) => Promise<{
    slug: string;
    introParagraphs: unknown;
    bulletPoints: unknown;
    id: string;
  }>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function createPostTemplateNoticeService(
  model: PostTemplateNoticeModelDelegate
) {
  async function getPostTemplateNotice(): Promise<PostTemplateNotice> {
    const existing = await model.findUnique({
      where: { slug: NOTICE_SLUG },
    });

    if (existing) {
      return mapRecordToNotice(existing);
    }

    const created = await model.create({
      data: {
        slug: NOTICE_SLUG,
        introParagraphs: DEFAULT_POST_TEMPLATE_NOTICE.introParagraphs,
        bulletPoints: DEFAULT_POST_TEMPLATE_NOTICE.bulletPoints,
      },
    });

    return mapRecordToNotice(created);
  }

  async function upsertPostTemplateNotice(
    payload: Omit<PostTemplateNotice, 'id'>
  ): Promise<PostTemplateNotice> {
    const record = await model.upsert({
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

  return { getPostTemplateNotice, upsertPostTemplateNotice };
}
