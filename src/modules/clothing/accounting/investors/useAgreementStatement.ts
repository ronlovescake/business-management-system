'use client';

import { useState } from 'react';
import { showNotification } from '@mantine/notifications';

async function downloadAgreementStatement(
  agreementId: string,
  filename: string
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
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
}

export function buildStatementEmail(investorName: string, reference: string) {
  return [
    `Subject: Investment Statement for ${reference}`,
    '',
    `Dear ${investorName},`,
    '',
    `Please find attached your investment statement for agreement ${reference}.`,
    '',
    'The statement includes your investment details, key contract dates, and the return schedule, including payments recorded as of the date it was generated. Please review it and contact us if you have any questions or notice any discrepancies.',
    '',
    'Please note that the statement reflects our records and projected return schedule. It is not a bank transfer receipt or confirmation from a financial institution.',
    '',
    'Thank you for your continued trust.',
    '',
    'Kind regards,',
    '',
    'Ron',
    'Czarlie & Ron',
  ].join('\n');
}

export function useAgreementStatement() {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadedAgreementId, setDownloadedAgreementId] = useState<
    string | null
  >(null);

  const copyEmail = async (investorName: string, reference: string) => {
    try {
      await navigator.clipboard.writeText(
        buildStatementEmail(investorName, reference)
      );
      showNotification({
        message: 'Email message copied to clipboard',
        color: 'green',
      });
    } catch {
      showNotification({
        message: 'Unable to copy the email message',
        color: 'red',
      });
    }
  };

  const download = async (
    agreementId: string,
    reference: string,
    investorName: string
  ) => {
    if (isDownloading) {
      return;
    }
    setIsDownloading(true);
    try {
      await downloadAgreementStatement(
        agreementId,
        `${investorName}-${reference}-statement.pdf`.replace(
          /[<>:"/\\|?*\x00-\x1F]/g,
          ''
        )
      );
      setDownloadedAgreementId(agreementId);
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

  return { isDownloading, download, downloadedAgreementId, copyEmail };
}
