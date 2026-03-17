import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestApiUrl, mockNextRequest } from '@/core/testing/test-helpers';

vi.mock('@/lib/accounting/cutover', () => ({
  getRuntimeAccountingCutoverDate: async () =>
    new Date('2026-01-17T00:00:00.000Z'),
}));

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  generalMerchandiseAccountingJournalLine: {
    create: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

describe('GM accounting manual journal route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (callback) =>
      callback(mockPrisma)
    );
    mockPrisma.generalMerchandiseAccountingJournalLine.create.mockResolvedValue(
      {}
    );
    mockPrisma.generalMerchandiseAccountingJournalLine.findMany.mockResolvedValue(
      [{ sourceLineKey: 'debit' }, { sourceLineKey: 'credit' }]
    );
    mockPrisma.generalMerchandiseAccountingJournalLine.updateMany.mockResolvedValue(
      { count: 1 }
    );
    mockPrisma.generalMerchandiseAccountingJournalLine.deleteMany.mockResolvedValue(
      { count: 2 }
    );
  });

  it('creates a GM manual journal entry pair', async () => {
    const { POST } = await import(
      '@/app/api/general-merchandise/accounting/manual-journal/route'
    );

    const request = mockNextRequest({
      method: 'POST',
      url: getTestApiUrl('/api/general-merchandise/accounting/manual-journal'),
      body: {
        date: '2026-01-20',
        ref: 'GM-MJ-1',
        debitAccount: 'Cash',
        creditAccount: 'Sales Revenue',
        amount: 250,
        description: 'GM manual entry',
      },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toBe('Manual journal entry saved');
    expect(
      mockPrisma.generalMerchandiseAccountingJournalLine.create
    ).toHaveBeenCalledTimes(2);
    expect(
      mockPrisma.generalMerchandiseAccountingJournalLine.create
    ).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          ref: 'GM-MJ-1',
          account: 'Cash',
          debit: 250,
          credit: 0,
          sourceType: 'MANUAL',
          sourceLineKey: 'debit',
        }),
      })
    );
    expect(
      mockPrisma.generalMerchandiseAccountingJournalLine.create
    ).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          ref: 'GM-MJ-1',
          account: 'Sales Revenue',
          debit: 0,
          credit: 250,
          sourceType: 'MANUAL',
          sourceLineKey: 'credit',
        }),
      })
    );
  });

  it('requires sourceId for PUT', async () => {
    const { PUT } = await import(
      '@/app/api/general-merchandise/accounting/manual-journal/route'
    );

    const request = mockNextRequest({
      method: 'PUT',
      url: getTestApiUrl('/api/general-merchandise/accounting/manual-journal'),
      body: {
        date: '2026-01-20',
        ref: 'GM-MJ-1',
        debitAccount: 'Cash',
        creditAccount: 'Sales Revenue',
        amount: 250,
      },
    });

    const response = await PUT(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Source id is required.');
  });

  it('returns the missing-table response when the GM journal table is unavailable', async () => {
    mockPrisma.$transaction.mockRejectedValueOnce({ code: 'P2021' });

    const { POST } = await import(
      '@/app/api/general-merchandise/accounting/manual-journal/route'
    );

    const request = mockNextRequest({
      method: 'POST',
      url: getTestApiUrl('/api/general-merchandise/accounting/manual-journal'),
      body: {
        date: '2026-01-20',
        ref: 'GM-MJ-2',
        debitAccount: 'Cash',
        creditAccount: 'Sales Revenue',
        amount: 100,
      },
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.success).toBe(false);
    expect(body.error).toBe(
      'Manual journal entries are not enabled in this database yet'
    );
    expect(body.details).toContain(
      'general_merchandise.accounting_journal_lines'
    );
  });
});
