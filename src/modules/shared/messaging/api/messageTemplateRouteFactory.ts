import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';
import { ApiResponseUtil } from '@/core/api/response';
import type { MessageTemplate } from '@/modules/clothing/operations/message-templates/types';

export interface MessageTemplateServiceLike {
  getMessageTemplatesFromDb: () => Promise<MessageTemplate[]>;
  upsertMessageTemplate: (payload: MessageTemplate) => Promise<MessageTemplate>;
  createMessageTemplate: (
    payload: Omit<MessageTemplate, 'id'>
  ) => Promise<MessageTemplate>;
}

export function createMessageTemplateRoutes(
  service: MessageTemplateServiceLike,
  domainLabel?: string
) {
  const label = domainLabel ? `${domainLabel} ` : '';

  async function GET() {
    try {
      const templates = await service.getMessageTemplatesFromDb();
      return ApiResponseUtil.success(templates);
    } catch (error) {
      logger.error(`Failed to load ${label}message templates`, error);
      return NextResponse.json(
        { error: 'Failed to load message templates' },
        { status: 500 }
      );
    }
  }

  async function PUT(request: NextRequest) {
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

      const template = await service.upsertMessageTemplate({
        id,
        title: title.trim(),
        badge: badge.trim(),
        paragraphs: sanitizedParagraphs,
      });

      return ApiResponseUtil.success(template);
    } catch (error) {
      logger.error(`Failed to update ${label}template`, error);
      return NextResponse.json(
        { error: 'Failed to update template' },
        { status: 500 }
      );
    }
  }

  async function POST(request: NextRequest) {
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

      const template = await service.createMessageTemplate({
        title: title.trim(),
        badge: badge.trim(),
        paragraphs: sanitizedParagraphs,
      });

      return ApiResponseUtil.success(template, undefined, 201);
    } catch (error) {
      logger.error(`Failed to create ${label}template`, error);
      return NextResponse.json(
        { error: 'Failed to create template' },
        { status: 500 }
      );
    }
  }

  return { GET, PUT, POST };
}
