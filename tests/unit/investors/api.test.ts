import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { getCurrentDateISO } from '@/utils/date';

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  investor: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  agreement: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  payment: { create: vi.fn() },
  closure: { findMany: vi.fn(), upsert: vi.fn(), update: vi.fn() },
  transaction: vi.fn(),
  lock: vi.fn(),
  journal: { findMany: vi.fn(), createMany: vi.fn(), count: vi.fn() },
}));

vi.mock('next-auth', () => ({ getServerSession: mocks.session }));
vi.mock('@/lib/auth/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/accounting/cutover', () => ({
  getRuntimeAccountingCutoverDate: async () => new Date('2026-01-17T00:00:00Z'),
}));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }));
vi.mock('@/lib/db', () => ({
  prisma: {
    clothingInvestor: mocks.investor,
    clothingInvestmentAgreement: mocks.agreement,
    clothingInvestmentPayment: mocks.payment,
    clothingInvestorBankClosure: mocks.closure,
    $transaction: mocks.transaction,
    $queryRaw: mocks.lock,
    clothingAccountingJournalLine: mocks.journal,
  },
}));

import { DELETE, GET, POST, PUT } from '@/app/api/clothing/investors/route';

const request = (method: string, body: unknown) =>
  new NextRequest('http://localhost/api/clothing/investors', {
    method,
    body: JSON.stringify(body),
  });

describe('investor API', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.session.mockResolvedValue({ user: { role: 'ADMIN' } });
    mocks.journal.findMany.mockResolvedValue([]);
    mocks.journal.count.mockResolvedValue(0);
    mocks.transaction.mockImplementation(async (operation) =>
      typeof operation === 'function'
        ? operation({
            clothingInvestmentAgreement: mocks.agreement,
            clothingInvestmentPayment: mocks.payment,
            clothingInvestorBankClosure: mocks.closure,
            clothingAccountingJournalLine: mocks.journal,
            $queryRaw: mocks.lock,
          })
        : [[], [], []]
    );
  });

  it('rejects unauthenticated and ordinary users on every method before database access', async () => {
    for (const session of [null, { user: { role: 'USER' } }]) {
      mocks.session.mockResolvedValue(session);
      const expected = session ? 403 : 401;
      expect((await GET()).status).toBe(expected);
      expect((await POST(request('POST', {}))).status).toBe(expected);
      expect((await PUT(request('PUT', {}))).status).toBe(expected);
      expect((await DELETE(request('DELETE', {}))).status).toBe(expected);
    }
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.investor.create).not.toHaveBeenCalled();
    expect(mocks.closure.update).not.toHaveBeenCalled();
  });

  it('serializes decimal amounts and applies stored closures', async () => {
    mocks.transaction.mockResolvedValue([
      [
        {
          id: 'investor',
          investorCode: 'INV-001',
          name: 'Test',
          agreements: [
            {
              id: 'agreement',
              principal: new Prisma.Decimal('100000.00'),
              monthlyRateBps: 500,
              effectiveDate: '2026-01-25',
              payments: [
                {
                  month: 3,
                  amount: new Prisma.Decimal('5000.01'),
                  paidDate: '2026-04-28',
                },
              ],
            },
          ],
        },
      ],
      [{ date: '2026-04-27', name: 'Closure' }],
    ]);
    const response = await GET();
    const body = await response.json();
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(body.investors[0].investorCode).toBe('INV-001');
    expect(body.investors[0].agreements[0].principal).toBe('100000.00');
    expect(body.investors[0].agreements[0].schedule.payouts[2].dueDate).toBe(
      '2026-04-28'
    );
    expect(body.investors[0].agreements[0].schedule.payouts[2].payment).toEqual(
      {
        amount: '5000.01',
        paidDate: '2026-04-28',
      }
    );
    expect(mocks.closure.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null },
      orderBy: { date: 'asc' },
    });
  });

  it('creates investor profiles with validated fields only', async () => {
    mocks.investor.create.mockResolvedValue({ id: 'investor' });
    const response = await POST(
      request('POST', {
        kind: 'investor',
        data: { name: 'Test', role: 'SUPER_ADMIN' },
      })
    );
    expect(response.status).toBe(201);
    expect(mocks.investor.create.mock.calls[0][0].data).not.toHaveProperty(
      'role'
    );
  });

  it('rejects invalid amounts, malformed JSON, and mismatched edit methods', async () => {
    expect(
      (
        await POST(
          request('POST', { kind: 'agreement', data: { principal: '-1' } })
        )
      ).status
    ).toBe(400);
    expect(
      (
        await POST(
          new NextRequest('http://localhost/api/clothing/investors', {
            method: 'POST',
            body: '{',
          })
        )
      ).status
    ).toBe(400);
    expect(
      (await PUT(request('PUT', { kind: 'investor', data: { name: 'Test' } })))
        .status
    ).toBe(400);
    expect(mocks.agreement.create).not.toHaveBeenCalled();
  });

  it('updates existing investors and creates agreements', async () => {
    mocks.investor.update.mockResolvedValue({ id: 'investor' });
    expect(
      (
        await PUT(
          request('PUT', {
            kind: 'investor',
            id: 'investor',
            data: { name: 'Changed' },
          })
        )
      ).status
    ).toBe(200);
    mocks.agreement.create.mockResolvedValue({ id: 'agreement' });
    expect(
      (
        await POST(
          request('POST', {
            kind: 'agreement',
            data: {
              investorId: 'investor',
              reference: 'CR-001',
              effectiveDate: '2026-01-25',
              principal: '100000.00',
            },
          })
        )
      ).status
    ).toBe(201);
    expect(mocks.agreement.create.mock.calls[0][0].data.monthlyRateBps).toBe(
      500
    );
  });

  it('soft-removes closures and restores them when saved again', async () => {
    mocks.closure.update.mockResolvedValue({ id: 'closure' });
    expect(
      (await DELETE(request('DELETE', { date: '2026-04-27' }))).status
    ).toBe(200);
    expect(mocks.closure.update).toHaveBeenCalledWith({
      where: { date: '2026-04-27' },
      data: { deletedAt: expect.any(Date) },
    });
    mocks.closure.upsert.mockResolvedValue({ id: 'closure' });
    expect(
      (
        await POST(
          request('POST', {
            kind: 'closure',
            data: { date: '2026-04-27', name: 'Closure' },
          })
        )
      ).status
    ).toBe(200);
    expect(mocks.closure.upsert.mock.calls[0][0].update.deletedAt).toBeNull();
  });

  it('returns a conflict for duplicate references', async () => {
    mocks.agreement.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Duplicate', {
        code: 'P2002',
        clientVersion: '5',
      })
    );
    expect(
      (
        await POST(
          request('POST', {
            kind: 'agreement',
            data: {
              investorId: 'investor',
              reference: 'CR-001',
              effectiveDate: '2026-01-25',
              principal: '100000.00',
            },
          })
        )
      ).status
    ).toBe(409);
  });

  it('records a due payout with actual amount and date, and rejects duplicates', async () => {
    mocks.agreement.findUnique.mockResolvedValue({
      id: 'agreement',
      reference: 'CR-001',
      effectiveDate: '2025-01-25',
      principal: new Prisma.Decimal('1000.00'),
      monthlyRateBps: 500,
    });
    mocks.closure.findMany.mockResolvedValue([]);
    mocks.payment.create.mockResolvedValue({ id: 'payment' });
    const body = {
      kind: 'payment',
      data: {
        agreementId: 'agreement',
        month: 3,
        amount: '50.00',
        paidDate: getCurrentDateISO(),
      },
    };
    const response = await POST(request('POST', body));
    expect(response.status).toBe(201);
    expect(mocks.payment.create).toHaveBeenCalledWith({
      data: body.data,
    });
    expect(mocks.journal.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          sourceId: 'payment',
          account: 'Investor Return Expense',
          debit: 50,
          credit: 0,
        }),
        expect.objectContaining({
          sourceId: 'payment',
          account: 'Cash',
          debit: 0,
          credit: 50,
        }),
      ],
    });
    mocks.payment.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Duplicate payout', {
        code: 'P2002',
        clientVersion: '5',
      })
    );
    expect((await POST(request('POST', body))).status).toBe(409);
  });

  it('rejects deferred, future, and invalid paid dates before writing', async () => {
    mocks.agreement.findUnique.mockResolvedValue({
      effectiveDate: '2025-01-25',
      principal: new Prisma.Decimal('1000.00'),
      monthlyRateBps: 500,
    });
    mocks.closure.findMany.mockResolvedValue([]);
    const mismatchedAmount = await POST(
      request('POST', {
        kind: 'payment',
        data: {
          agreementId: 'agreement',
          month: 3,
          amount: '49.99',
          paidDate: getCurrentDateISO(),
        },
      })
    );
    expect(mismatchedAmount.status).toBe(400);
    const deferred = await POST(
      request('POST', {
        kind: 'payment',
        data: {
          agreementId: 'agreement',
          month: 1,
          amount: '50',
          paidDate: getCurrentDateISO(),
        },
      })
    );
    expect(deferred.status).toBe(400);
    mocks.agreement.findUnique.mockResolvedValue({
      effectiveDate: '2026-10-01',
      principal: new Prisma.Decimal('1000.00'),
      monthlyRateBps: 500,
    });
    const future = await POST(
      request('POST', {
        kind: 'payment',
        data: {
          agreementId: 'agreement',
          month: 3,
          amount: '50',
          paidDate: getCurrentDateISO(),
        },
      })
    );
    expect(future.status).toBe(400);
    expect(mocks.payment.create).not.toHaveBeenCalled();
  });

  it('prevents changing agreement financial terms after a payout is recorded', async () => {
    mocks.agreement.findUnique.mockResolvedValue({
      effectiveDate: '2025-01-25',
      principal: new Prisma.Decimal('1000.00'),
      monthlyRateBps: 500,
      _count: { payments: 1 },
    });
    const response = await PUT(
      request('PUT', {
        kind: 'agreement',
        id: 'agreement',
        data: {
          investorId: 'investor',
          reference: 'CR-001',
          effectiveDate: '2025-01-26',
          principal: '1000.00',
          monthlyRateBps: 500,
          notes: '',
        },
      })
    );
    expect(response.status).toBe(409);
    expect(mocks.agreement.update).not.toHaveBeenCalled();
  });
});
