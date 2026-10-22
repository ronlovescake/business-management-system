import { describe, expect, it } from 'vitest';
import { buildStatementEmail } from '@/modules/clothing/accounting/investors/useAgreementStatement';

describe('investor statement email', () => {
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
