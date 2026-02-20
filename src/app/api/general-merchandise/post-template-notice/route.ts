import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';
import { DEFAULT_POST_TEMPLATE_NOTICE } from '@/modules/clothing/operations/post-template/notice.data';
import type { PostTemplateNotice } from '@/modules/clothing/operations/post-template/notice.types';
import { ApiResponseUtil } from '@/core/api/response';

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

async function getPostTemplateNotice(): Promise<PostTemplateNotice> {
  const existing = await prisma.generalMerchandisePostTemplateNotice.findUnique(
    {
      where: { slug: NOTICE_SLUG },
    }
  );

  if (existing) {
    return mapRecordToNotice(existing);
  }

  const created = await prisma.generalMerchandisePostTemplateNotice.create({
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
  const record = await prisma.generalMerchandisePostTemplateNotice.upsert({
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

export async function GET() {
  try {
    const notice = await getPostTemplateNotice();
    return ApiResponseUtil.success(notice);
  } catch (error) {
    logger.error('Failed to load GM post template notice', error);
    return NextResponse.json(
      { error: 'Failed to load post template notice' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const introParagraphs = Array.isArray(body?.introParagraphs)
      ? body.introParagraphs
      : [];
    const bulletPoints = Array.isArray(body?.bulletPoints)
      ? body.bulletPoints
      : [];

    const sanitizedIntro = introParagraphs
      .map((paragraph: unknown) =>
        typeof paragraph === 'string' ? paragraph.trim() : ''
      )
      .filter(Boolean);
    const sanitizedBullets = bulletPoints
      .map((item: unknown) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);

    if (sanitizedIntro.length === 0) {
      return NextResponse.json(
        { error: 'At least one intro paragraph is required' },
        { status: 400 }
      );
    }

    if (sanitizedBullets.length === 0) {
      return NextResponse.json(
        { error: 'At least one bullet point is required' },
        { status: 400 }
      );
    }

    const notice = await upsertPostTemplateNotice({
      introParagraphs: sanitizedIntro,
      bulletPoints: sanitizedBullets,
    });

    return ApiResponseUtil.success(notice);
  } catch (error) {
    logger.error('Failed to update GM post template notice', error);
    return NextResponse.json(
      { error: 'Failed to update post template notice' },
      { status: 500 }
    );
  }
}
