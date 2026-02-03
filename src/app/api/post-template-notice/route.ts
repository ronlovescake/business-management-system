import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';
import { ApiResponseUtil } from '@/core/api/response';
import {
  getPostTemplateNotice,
  upsertPostTemplateNotice,
} from '@/modules/clothing/operations/post-template/notice.service';

export async function GET() {
  try {
    const notice = await getPostTemplateNotice();
    return ApiResponseUtil.success(notice);
  } catch (error) {
    logger.error('Failed to load post template notice', error);
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
    logger.error('Failed to update post template notice', error);
    return NextResponse.json(
      { error: 'Failed to update post template notice' },
      { status: 500 }
    );
  }
}
