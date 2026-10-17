import { beforeEach, describe, it, expect, vi } from 'vitest';
import {
  fetchManualJournalLines,
  getPaidAtDate,
} from '@/lib/accounting/data-fetchers';
import { detectAccountType } from '@/lib/accounting/account-classification';

const mocks = vi.hoisted(() => ({ journal: vi.fn(), agreements: vi.fn() }));

vi.mock('@/lib/db', () => ({
  prisma: {
    clothingAccountingJournalLine: { findMany: mocks.journal },
    clothingInvestmentAgreement: { findMany: mocks.agreements },
  },
}));

describe('investor account report labels', () => {
  const params = { from: new Date('2026-01-17'), to: null };
  const line = {
    id: 'funding-credit',
    date: new Date('2026-04-25'),
    ref: 'INV-CR-001',
    account: 'Loan Payable - Investor agreement-1',
    debit: 0,
    credit: 1000000,
    description: 'Investor funding: CR-001',
    sourceType: 'INVESTOR_FUNDING',
    sourceId: 'agreement-1',
    sourceLineKey: 'credit',
    systemGenerated: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.agreements.mockResolvedValue([]);
  });

  it('labels existing funding and repayment with investor name and contract reference', async () => {
    const repayment = {
      ...line,
      id: 'repayment-debit',
      debit: 1000000,
      credit: 0,
      sourceType: 'INVESTOR_REPAYMENT',
    };
    const cash = {
      ...line,
      id: 'funding-cash',
      account: 'Cash',
      debit: 1000000,
      credit: 0,
    };
    mocks.journal.mockResolvedValue([line, repayment, cash]);
    mocks.agreements.mockResolvedValue([
      {
        id: 'agreement-1',
        reference: 'CR-001',
        investor: { name: 'Carrei Cyrell R. Mabanag' },
      },
    ]);
    const rows = await fetchManualJournalLines(params);
    expect(rows.slice(0, 2).map((row) => row.account)).toEqual([
      'Investor Funding Payable - Carrei Cyrell R. Mabanag - CR-001',
      'Investor Funding Payable - Carrei Cyrell R. Mabanag - CR-001',
    ]);
    expect(detectAccountType(rows[0].account)).toBe('Liability');
    expect(
      detectAccountType('Investor Funding Payable - Cash Holdings - CR-002')
    ).toBe('Liability');
    expect(rows[0]).toEqual({ ...line, account: rows[0].account });
    expect(rows[1]).toEqual({ ...repayment, account: rows[1].account });
    expect(rows[2]).toEqual(cash);
    expect(line.account).toBe('Loan Payable - Investor agreement-1');
    expect(mocks.agreements).toHaveBeenCalledWith({
      where: { id: { in: ['agreement-1'] } },
      select: {
        id: true,
        reference: true,
        investor: { select: { name: true } },
      },
    });
  });

  it('keeps the stable account identifier when the agreement is unavailable', async () => {
    mocks.journal.mockResolvedValue([line]);
    const rows = await fetchManualJournalLines(params);
    expect(rows).toEqual([
      { ...line, account: 'Investor Funding Payable - agreement-1' },
    ]);
    expect(detectAccountType(rows[0].account)).toBe('Liability');
  });

  it('does not query agreements for unrelated accounts', async () => {
    const cash = { ...line, account: 'Cash' };
    mocks.journal.mockResolvedValue([cash]);
    expect(await fetchManualJournalLines(params)).toEqual([cash]);
    expect(mocks.agreements).not.toHaveBeenCalled();
  });
});

// This is intentionally a minimal shape to avoid DB coupling.

describe('accounting data-fetchers - getPaidAtDate', () => {
  it('prefers packedDate (completion) over other dates', () => {
    const tx = {
      orderDate: '2025-12-07',
      packedDate: '2026-01-15',
      statusChanges: [
        { newStatus: 'shipped', changedAt: new Date('2026-01-14') },
      ],
    } as Parameters<typeof getPaidAtDate>[0];

    const paidAt = getPaidAtDate(tx);

    expect(paidAt?.toISOString().slice(0, 10)).toBe('2026-01-15');
  });

  it('prefers paid-status change timestamps over orderDate when packedDate is missing', () => {
    const tx = {
      orderDate: '2025-12-07',
      statusChanges: [
        { newStatus: 'Shipped', changedAt: new Date('2026-01-14') },
      ],
    } as Parameters<typeof getPaidAtDate>[0];

    const paidAt = getPaidAtDate(tx);

    expect(paidAt?.toISOString().slice(0, 10)).toBe('2026-01-14');
  });

  it('falls back to earliest paid-status change when orderDate is missing', () => {
    const tx = {
      orderDate: null,
      statusChanges: [
        { newStatus: 'Shipped', changedAt: new Date('2026-01-10') },
        { newStatus: 'Shipped', changedAt: new Date('2026-01-11') },
      ],
    } as Parameters<typeof getPaidAtDate>[0];

    const paidAt = getPaidAtDate(tx);

    expect(paidAt?.toISOString().slice(0, 10)).toBe('2026-01-10');
  });

  it('for post-cutover transactions, prefers the paid-status change timestamp over orderDate', () => {
    const tx = {
      orderDate: '2026-01-20',
      statusChanges: [
        { newStatus: 'Shipped', changedAt: new Date('2026-02-10') },
      ],
    } as Parameters<typeof getPaidAtDate>[0];

    const paidAt = getPaidAtDate(tx);

    expect(paidAt?.toISOString().slice(0, 10)).toBe('2026-02-10');
  });
});
