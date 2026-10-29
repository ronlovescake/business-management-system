import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { showNotification } from '@mantine/notifications';
import {
  buildStatementEmail,
  useAgreementStatement,
} from '@/modules/clothing/accounting/investors/useAgreementStatement';

vi.mock('@mantine/notifications', () => ({ showNotification: vi.fn() }));

describe('investor statement email', () => {
  it('copies without the async clipboard API on plain HTTP', async () => {
    const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand,
    });
    try {
      const { result } = renderHook(() => useAgreementStatement());
      await result.current.copyEmail('Investor', 'CR-2026-004');
      expect(execCommand).toHaveBeenCalledWith('copy');
      expect(showNotification).toHaveBeenCalledWith({
        message: 'Email message copied to clipboard',
        color: 'green',
      });
    } finally {
      if (clipboard) {
        Object.defineProperty(navigator, 'clipboard', clipboard);
      } else {
        delete (navigator as { clipboard?: Clipboard }).clipboard;
      }
      delete (document as { execCommand?: unknown }).execCommand;
    }
  });

  it('fills the investor name and agreement reference', () => {
    const email = buildStatementEmail(
      'Carrei Cyrell R. Mabanag',
      'CR-2026-003'
    );
    const lines = email.split('\n');
    expect(lines[0]).toBe('Subject: Investment Statement for CR-2026-003');
    expect(email).toContain('Dear Carrei Cyrell R. Mabanag,');
    expect(email).toContain(
      'Please find attached your investment statement for agreement CR-2026-003.'
    );
    expect(lines.slice(-2)).toEqual(['Ron', 'Czarlie & Ron']);
    expect(email).not.toContain('[');
  });
});
