import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';
import {
  getMessageTemplatesFromDb,
  upsertMessageTemplate,
} from '@/modules/clothing/operations/message-templates/messageTemplates.service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'default-no-store';

export async function GET() {
  try {
    const templates = await getMessageTemplatesFromDb();
    return NextResponse.json({ success: true, data: templates });
  } catch (error) {
    logger.error('Failed to load message templates', error);
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
    logger.error('Failed to update template', error);
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    );
  }
}
