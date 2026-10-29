'use client';

import { useState } from 'react';
import { showNotification } from '@mantine/notifications';
import { copyTextToClipboard } from '@/modules/clothing/operations/checkout-links/lib/clipboard';

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

const ORDINALS = [
  'first',
  'second',
  'third',
  'fourth',
  'fifth',
  'sixth',
  'seventh',
  'eighth',
  'ninth',
  'tenth',
  'eleventh',
  'twelfth',
  'thirteenth',
  'fourteenth',
  'fifteenth',
  'sixteenth',
  'seventeenth',
  'eighteenth',
  'nineteenth',
];
const TENS_ORDINALS: Record<number, string> = {
  2: 'twentieth',
  3: 'thirtieth',
};
const TENS: Record<number, string> = {
  2: 'twenty',
  3: 'thirty',
};

function payoutOrdinal(value: number): string {
  if (value <= ORDINALS.length) {
    return ORDINALS[value - 1] ?? 'first';
  }
  const tens = Math.floor(value / 10);
  const units = value % 10;
  if (units === 0) {
    return TENS_ORDINALS[tens] ?? `${value}th`;
  }
  return `${TENS[tens] ?? ''}-${ORDINALS[units - 1] ?? `${units}th`}`;
}

function emailDate(value: string, includeYear: boolean): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    ...(includeYear && { year: 'numeric' }),
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

export function buildPayoutEmail(input: {
  investorName: string;
  reference: string;
  payoutNumber: number;
  amount: string;
  bankingDate: string;
  paidDate: string;
}): string {
  const ordinal = payoutOrdinal(input.payoutNumber);
  return [
    `Subject: ${ordinal[0].toUpperCase()}${ordinal.slice(1)} Investment Payout for ${input.reference} — ${emailDate(input.bankingDate, false)}`,
    '',
    `Dear ${input.investorName},`,
    '',
    `Your ${ordinal} investment payout of ${input.amount} for agreement ${input.reference} was transferred on ${emailDate(input.paidDate, true)}.`,
    '',
    'Attached are your payout statement and a copy of the bank transfer confirmation for your records. Please let us know if you have any questions.',
    '',
    'Thank you for your continued trust.',
    '',
    'Kind regards,',
    'Czarlie & Ron',
  ].join('\n');
}

export function useInvestorStatements() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadedMonth, setDownloadedMonth] = useState<string | null>(null);

  const generate = async (month: string) => {
    if (isGenerating) {
      return;
    }
    setIsGenerating(true);
    try {
      await downloadInvestorStatements(month);
      setDownloadedMonth(month);
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

  const copyEmail = async (input: Parameters<typeof buildPayoutEmail>[0]) => {
    const copied = await copyTextToClipboard(buildPayoutEmail(input));
    showNotification(
      copied
        ? { message: 'Payout email copied to clipboard', color: 'green' }
        : { message: 'Unable to copy the payout email', color: 'red' }
    );
  };

  return { isGenerating, generate, downloadedMonth, copyEmail };
}
