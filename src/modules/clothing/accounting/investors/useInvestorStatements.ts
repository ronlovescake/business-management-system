'use client';

import { useState } from 'react';
import { showNotification } from '@mantine/notifications';

async function downloadInvestorStatements(month: string) {
  const response = await fetch('/api/clothing/investors/generate-statements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ month }),
  });
  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(result?.error || 'Unable to generate payout statements');
  }

  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `investor-payout-statements-${month}.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
}

export function useInvestorStatements() {
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = async (month: string) => {
    if (isGenerating) {
      return;
    }
    setIsGenerating(true);
    try {
      await downloadInvestorStatements(month);
      showNotification({
        message: 'Payout statements downloaded',
        color: 'green',
      });
    } catch (error) {
      showNotification({
        message:
          error instanceof Error
            ? error.message
            : 'Unable to generate payout statements',
        color: 'red',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return { isGenerating, generate };
}
