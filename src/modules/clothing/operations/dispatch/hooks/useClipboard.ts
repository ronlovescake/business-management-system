'use client';

import { useCallback } from 'react';
import { showNotification } from '@mantine/notifications';
import { logger } from '@/lib/logger';

export function useClipboard() {
  // Legacy copy fallback for browsers without navigator.clipboard support
  const fallbackCopyToClipboard = useCallback((text: string) => {
    if (typeof document === 'undefined') {
      throw new Error('Clipboard unavailable in this context');
    }

    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '-1000px';
    textArea.setAttribute('readonly', 'true');
    document.body.appendChild(textArea);
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);

    if (!successful) {
      throw new Error('execCommand copy failed');
    }
  }, []);

  // Copy to clipboard handler with secure-context fallback
  const copyToClipboard = useCallback(
    async (text: string, label: string) => {
      const hasNavigatorClipboard =
        typeof navigator !== 'undefined' &&
        !!navigator.clipboard &&
        typeof navigator.clipboard.writeText === 'function';

      const notifySuccess = () => {
        showNotification({
          title: 'Copied!',
          message: `${label} copied to clipboard`,
          color: 'green',
          position: 'top-right',
          autoClose: 2000,
        });
      };

      try {
        if (hasNavigatorClipboard) {
          await navigator.clipboard.writeText(text);
        } else {
          fallbackCopyToClipboard(text);
        }
        notifySuccess();
      } catch (err) {
        try {
          fallbackCopyToClipboard(text);
          notifySuccess();
        } catch (fallbackError) {
          logger.error('Failed to copy to clipboard', fallbackError);
          showNotification({
            title: 'Failed to copy',
            message: 'Clipboard access is blocked. Please copy manually.',
            color: 'red',
            position: 'top-right',
            autoClose: 2000,
          });
        }
      }
    },
    [fallbackCopyToClipboard]
  );

  return { copyToClipboard };
}
