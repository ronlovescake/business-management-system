import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getTestApiUrl } from '@/core/testing/test-helpers';

const mocks = vi.hoisted(() => ({
  actor: { id: 'admin', role: 'ADMIN' },
  requireAuth: vi.fn(),
  getCurrentUser: vi.fn(),
  zero: vi.fn(),
  correction: vi.fn(),
  cogs: vi.fn(),
  products: vi.fn(),
  lines: vi.fn(),
  history: vi.fn(),
}));
vi.mock('@/lib/auth/session', async (original) => ({
  ...(await original<typeof import('@/lib/auth/session')>()),
  requireAuth: mocks.requireAuth,
  getCurrentUser: mocks.getCurrentUser,
}));
vi.mock('@/lib/accounting/inventory-valuation', async (original) => ({
  ...(await original<typeof import('@/lib/accounting/inventory-valuation')>()),
  confirmZeroCostMovement: mocks.zero,
  recordDatedCostCorrection: mocks.correction,
}));
vi.mock('@/lib/accounting/inventory-cogs', () => ({
  buildCogsAndInventoryEntries: mocks.cogs,
}));
vi.mock('@/lib/accounting/cutover', () => ({
  getRuntimeAccountingCutoverDate: vi.fn(
    async () => new Date('2026-01-17T00:00:00Z')
  ),
}));
vi.mock('@/lib/db', () => ({
  prisma: {
    product: { findMany: mocks.products },
    clothingAccountingJournalLine: { findMany: mocks.lines },
    clothingFinancialRequest: { findMany: mocks.history },
  },
}));
import { GET, PATCH, POST } from '../route';

const key = '3cb2bccb-ff51-4286-bb1f-af6c1a27c620';
const correction = {
  productId: 5,
  expectedUnitCost: 100,
  newUnitCost: 120,
  date: '2026-10-26',
  capitalizationLineId: 'posted-cost',
  reason: 'Confirmed freight already capitalized',
};
function request(method: string, body?: unknown, stableKey = key, suffix = '') {
  return new NextRequest(
    getTestApiUrl(`/api/accounting/inventory-valuation${suffix}`),
    {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(stableKey ? { 'Idempotency-Key': stableKey } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }
  );
}

describe('administrator inventory valuation API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue(mocks.actor);
    mocks.requireAuth.mockResolvedValue(mocks.actor);
    mocks.zero.mockResolvedValue({ movementId: 42 });
    mocks.correction.mockResolvedValue({
      ...correction,
      soldDelta: 80,
      stockDelta: 120,
    });
    mocks.cogs.mockResolvedValue({ valuationIssues: [] });
    mocks.products.mockResolvedValue([
      {
        id: 5,
        productCode: 'SKU',
        shipmentCode: 'SHIP',
        quantity: 10,
        landedUnitCost: 100,
        cogs: 1000,
      },
    ]);
    mocks.lines.mockResolvedValue([
      {
        id: 'posted-cost',
        ref: 'SKU',
        date: new Date('2026-10-25'),
        debit: 200,
        credit: 0,
      },
    ]);
    mocks.history.mockResolvedValue([]);
  });
  it('rejects unauthenticated requests before reading valuation or products', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const result = await GET(request('GET'));
    expect(result.status).toBe(401);
    expect(mocks.cogs).not.toHaveBeenCalled();
    expect(mocks.products).not.toHaveBeenCalled();
  });
  it.each(['GET', 'POST', 'PATCH'])(
    'rejects staff on %s before a read or decision',
    async (method) => {
      mocks.getCurrentUser.mockResolvedValue({ id: 'staff', role: 'USER' });
      mocks.requireAuth.mockResolvedValue({ id: 'staff', role: 'USER' });
      const handler = method === 'GET' ? GET : method === 'POST' ? POST : PATCH;
      expect(
        (
          await handler(
            request(method, method === 'GET' ? undefined : correction)
          )
        ).status
      ).toBe(403);
      expect(mocks.cogs).not.toHaveBeenCalled();
      expect(mocks.zero).not.toHaveBeenCalled();
      expect(mocks.correction).not.toHaveBeenCalled();
    }
  );
  it('scopes historical completeness to the requested cutoff and accounting start', async () => {
    expect(
      (
        await GET(
          request('GET', undefined, key, '?from=2020-01-01&to=2026-10-25')
        )
      ).status
    ).toBe(200);
    expect(mocks.cogs).toHaveBeenCalledWith({
      from: new Date('2026-01-17'),
      to: expect.any(Date),
    });
  });
  it('provides posted capitalization and product basis for explicit administrator review', async () => {
    const result = await (
      await GET(request('GET', undefined, key, '?review=cost-corrections'))
    ).json();
    expect(result.data.products[0]).toMatchObject({
      id: 5,
      unitCost: 100,
      quantity: 10,
    });
    expect(result.data.capitalizations[0]).toMatchObject({
      id: 'posted-cost',
      amount: 200,
    });
    expect(mocks.cogs).not.toHaveBeenCalled();
  });
  it('requires a stable request key for a genuine-zero decision', async () => {
    expect(
      (
        await POST(
          request(
            'POST',
            { movementId: 42, reason: 'Supplier supplied goods free' },
            ''
          )
        )
      ).status
    ).toBe(400);
    expect(mocks.zero).not.toHaveBeenCalled();
  });
  it('passes the unchanged UUID, explicit zero reason and actor to the authoritative service', async () => {
    const body = { movementId: 42, reason: 'Supplier supplied goods free' };
    expect((await POST(request('POST', body))).status).toBe(201);
    expect(mocks.zero).toHaveBeenCalledWith(key, body, mocks.actor);
  });
  it('validates corrections before persistence and preserves their stable request identity', async () => {
    expect(
      (await PATCH(request('PATCH', { ...correction, newUnitCost: -1 }))).status
    ).toBe(400);
    expect(mocks.correction).not.toHaveBeenCalled();
    expect((await PATCH(request('PATCH', correction))).status).toBe(201);
    expect(mocks.correction).toHaveBeenCalledWith(key, correction, mocks.actor);
  });
});
