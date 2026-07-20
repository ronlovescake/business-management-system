'use client';

import { buildApiPath } from '@/lib/api/paths';
import { logger } from '@/lib/logger';

type DocumentGenerationNotificationInput = {
  apiBasePath?: string;
  documentType: string;
  message: string;
  count: number;
  filename?: string;
};

export async function logDocumentGenerationNotification({
  apiBasePath,
  documentType,
  message,
  count,
  filename,
}: DocumentGenerationNotificationInput) {
  try {
    const response = await fetch(
      buildApiPath(apiBasePath, '/operations/notifications'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'documents',
          user: 'Operations',
          changes: message,
          metadata: {
            documentType,
            count,
            filename: filename ?? null,
          },
        }),
      }
    );

    if (!response.ok) {
      logger.warn('Failed to persist document generation notification', {
        documentType,
        status: response.status,
      });
    }
  } catch (error) {
    logger.warn('Failed to persist document generation notification', {
      documentType,
      error,
    });
  }
}
