'use client';

import { useState } from 'react';
import { showNotification } from '@mantine/notifications';

async function downloadAgreementStatement(
  agreementId: string,
  reference: string
) {
  const response = await fetch(
    `/api/clothing/investors/agreements/${encodeURIComponent(agreementId)}/statement`
  );
  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(result?.error || 'Unable to generate agreement statement');
  }

  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `${reference}-returns.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
}

export function useAgreementStatement() {
  const [isDownloading, setIsDownloading] = useState(false);

  const download = async (agreementId: string, reference: string) => {
    if (isDownloading) {
      return;
    }
    setIsDownloading(true);
    try {
      await downloadAgreementStatement(agreementId, reference);
      showNotification({
        message: 'Agreement statement downloaded',
        color: 'green',
      });
    } catch (error) {
      showNotification({
        message:
          error instanceof Error
            ? error.message
            : 'Unable to generate agreement statement',
        color: 'red',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return { isDownloading, download };
}
