import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { investorPostingLines } from '@/lib/investors/accounting';
import { detectAccountType } from '@/lib/accounting/account-classification';

describe('investor double-entry accounting', () => {
  const input = {
    agreementId: 'agreement-1',
    reference: 'INV-001',
    sourceId: 'agreement-1',
    amount: new Prisma.Decimal('1000000.00'),
    date: '2026-01-25',
    cutover: new Date('2026-01-17T00:00:00Z'),
  };

  it('adds received capital to cash and liabilities, not income', () => {
    const lines = investorPostingLines({ ...input, kind: 'funding' });
    expect(
      lines.map((line) => [line.account, line.debit, line.credit])
    ).toEqual([
      ['Cash', 1000000, 0],
      ['Loan Payable - Investor agreement-1', 0, 1000000],
    ]);
    expect(detectAccountType(lines[1].account)).toBe('Liability');
  });

  it('reduces cash and profit for returns without reducing principal owed', () => {
    const lines = investorPostingLines({
      ...input,
      kind: 'return',
      amount: new Prisma.Decimal('50000.00'),
    });
    expect(
      lines.map((line) => [line.account, line.debit, line.credit])
    ).toEqual([
      ['Investor Return Expense', 50000, 0],
      ['Cash', 0, 50000],
    ]);
    expect(detectAccountType(lines[0].account)).toBeNull();
  });

  it('repays principal by reducing cash and liabilities, not profit', () => {
    const lines = investorPostingLines({ ...input, kind: 'repayment' });
    expect(lines.map((line) => [line.debit, line.credit])).toEqual([
      [1000000, 0],
      [0, 1000000],
    ]);
    expect(detectAccountType(lines[0].account)).toBe('Liability');
  });

  it('rejects dates before cutover and invalid amounts', () => {
    expect(() =>
      investorPostingLines({ ...input, kind: 'funding', date: '2025-01-01' })
    ).toThrow('opening balances');
    expect(() =>
      investorPostingLines({
        ...input,
        kind: 'return',
        amount: new Prisma.Decimal('-1'),
      })
    ).toThrow('positive');
  });
});
