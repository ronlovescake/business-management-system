import { beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { NextRequest } from 'next/server';
import { logisticsLineKey } from '@/modules/clothing/operations/shipments/lib/logisticsCosts';
const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  cutover: vi.fn(),
  shipment: { findFirst: vi.fn() },
  clothingAccountingJournalLine: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}));
vi.mock('@/lib/db', () => ({ prisma: mocks }));
vi.mock('@/lib/auth/session', () => ({ getCurrentUser: mocks.currentUser }));
vi.mock('@/lib/accounting/cutover', () => ({
  getRuntimeAccountingCutoverDate: mocks.cutover,
}));
import { POST } from '@/app/api/accounting/shipment-logistics/route';

const input = {
  requestId: randomUUID(),
  shipmentId: 1,
  vendor: 'Forwarder',
  action: 'accrue',
  date: '2026-10-24',
  amount: 5000,
  ref: 'TEST-SHIPMENT',
  description: '',
  clearingAccount: 'Landed Cost Clearing',
  payableAccount: 'Forwarder Payable',
};
const post = (change: Record<string, unknown> = {}) =>
  POST(
    new NextRequest('http://localhost/api/accounting/shipment-logistics', {
      method: 'POST',
      body: JSON.stringify({ ...input, ...change }),
    })
  );
const actualLines = () =>
  ['debit', 'credit'].map((side) => ({
    sourceType: 'SHIPMENT_LOGISTICS',
    sourceLineKey: logisticsLineKey(
      1,
      'Forwarder',
      'accrue',
      side as 'debit' | 'credit'
    ),
    debit: side === 'debit' ? 5000 : 0,
    credit: side === 'credit' ? 5000 : 0,
    account: side === 'debit' ? input.clearingAccount : input.payableAccount,
  }));

describe('actual shipment logistics API', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.currentUser.mockResolvedValue({ id: 'test-admin', role: 'ADMIN' });
    mocks.cutover.mockResolvedValue(new Date('2026-01-01'));
    mocks.$transaction.mockImplementation(async (operation) =>
      operation(mocks)
    );
    mocks.shipment.findFirst.mockResolvedValue({
      id: 1,
      shipmentCode: 'TEST-SHIPMENT',
      shipmentStatus: 'In Transit',
    });
    mocks.clothingAccountingJournalLine.findMany.mockResolvedValue([]);
    mocks.clothingAccountingJournalLine.findFirst.mockResolvedValue(null);
  });

  it('posts a balanced actual charge under a stable request identity', async () => {
    expect((await post()).status).toBe(201);
    expect(mocks.clothingAccountingJournalLine.create).toHaveBeenCalledTimes(2);
    expect(mocks.clothingAccountingJournalLine.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceId: `logistics:${input.requestId}`,
        sourceType: 'SHIPMENT_LOGISTICS',
        debit: 5000,
        credit: 0,
      }),
    });
    expect(mocks.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'Serializable' })
    );
  });

  it('rejects payment beyond the actual balance', async () => {
    mocks.clothingAccountingJournalLine.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(actualLines());
    expect((await post({ action: 'pay', amount: 5000.01 })).status).toBe(409);
    expect(mocks.clothingAccountingJournalLine.create).not.toHaveBeenCalled();
  });

  it('allows a partial payment', async () => {
    mocks.clothingAccountingJournalLine.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(actualLines());
    expect((await post({ action: 'pay', amount: 2000 })).status).toBe(201);
  });

  it('requires delivery before capitalization', async () => {
    expect((await post({ action: 'capitalize' })).status).toBe(409);
    expect(mocks.clothingAccountingJournalLine.create).not.toHaveBeenCalled();
  });

  it('reuses an identical saved request without posting another pair', async () => {
    mocks.clothingAccountingJournalLine.findMany.mockResolvedValue(
      actualLines().map((line) => ({
        ...line,
        date: new Date(input.date),
        ref: input.ref,
        description: null,
      }))
    );
    const response = await post();
    expect(response.status).toBe(200);
    expect((await response.json()).data.reused).toBe(true);
    expect(mocks.clothingAccountingJournalLine.create).not.toHaveBeenCalled();
  });

  it('rejects changed data under the same saved request key', async () => {
    mocks.clothingAccountingJournalLine.findMany.mockResolvedValue(
      actualLines().map((line) => ({
        ...line,
        date: new Date(input.date),
        ref: input.ref,
        description: null,
      }))
    );
    expect((await post({ amount: 4000 })).status).toBe(409);
    expect(mocks.clothingAccountingJournalLine.create).not.toHaveBeenCalled();
  });

  it('honors the runtime clothing cutover before starting a transaction', async () => {
    mocks.cutover.mockResolvedValue(new Date('2026-10-25'));
    expect((await post()).status).toBe(400);
    expect(mocks.$transaction).not.toHaveBeenCalled();
  });

  it('preserves legacy history and requires review rather than guessing', async () => {
    mocks.clothingAccountingJournalLine.findFirst.mockResolvedValue({
      id: 'legacy',
    });
    expect((await post()).status).toBe(409);
    expect(mocks.clothingAccountingJournalLine.create).not.toHaveBeenCalled();
  });

  it.each([
    { amount: -1 },
    { amount: 1.001 },
    { date: '2026-02-30' },
    { requestId: 'invalid' },
    { clearingAccount: 'Cash' },
  ])('rejects invalid posting %j before writes', async (change) => {
    expect((await post(change)).status).toBe(400);
    expect(mocks.$transaction).not.toHaveBeenCalled();
  });
});
