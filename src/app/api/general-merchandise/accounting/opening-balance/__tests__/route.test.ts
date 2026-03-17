import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestApiUrl } from '@/core/testing/test-helpers';
import { NextRequest } from 'next/server';

vi.mock('@/lib/accounting/cutover', () => ({
  getRuntimeAccountingCutoverDate: async () =>
    new Date('2026-01-17T00:00:00.000Z'),
}));

const mockPrisma = vi.hoisted(() => ({
  generalMerchandiseAccountingOpeningBalance: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

const buildRequest = (
  path: string,
  init?: ConstructorParameters<typeof NextRequest>[1]
) => new NextRequest(getTestApiUrl(path), init);

describe('GM accounting opening balance route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.generalMerchandiseAccountingOpeningBalance.findMany.mockResolvedValue(
      []
    );
    mockPrisma.generalMerchandiseAccountingOpeningBalance.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'gm-ob-1',
        ...data,
      })
    );
    mockPrisma.generalMerchandiseAccountingOpeningBalance.update.mockImplementation(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => ({
        id: where.id,
        ...data,
      })
    );
    mockPrisma.generalMerchandiseAccountingOpeningBalance.delete.mockResolvedValue(
      { id: 'gm-ob-1' }
    );
  });

  it('returns cutover metadata and GM opening balance entries', async () => {
    mockPrisma.generalMerchandiseAccountingOpeningBalance.findMany.mockResolvedValue(
      [
        {
          id: 'gm-ob-1',
          date: new Date('2026-01-17T00:00:00.000Z'),
          ref: 'OPENING',
          account: 'Cash',
          debit: 300,
          credit: 0,
          description: 'GM opening cash',
        },
      ]
    );

    const { GET } = await import(
      '@/app/api/general-merchandise/accounting/opening-balance/route'
    );

    const response = await GET(
      buildRequest(
        '/api/general-merchandise/accounting/opening-balance?from=2026-01-01&to=2026-01-31'
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.cutoverDate).toBe('2026-01-17');
    expect(body.data.entries).toEqual([
      expect.objectContaining({
        id: 'gm-ob-1',
        ref: 'OPENING',
        account: 'Cash',
        debit: 300,
        credit: 0,
      }),
    ]);
  });

  it('creates an opening balance entry at the GM cutover date', async () => {
    const { POST } = await import(
      '@/app/api/general-merchandise/accounting/opening-balance/route'
    );

    const response = await POST(
      buildRequest('/api/general-merchandise/accounting/opening-balance', {
        method: 'POST',
        body: JSON.stringify({
          account: 'Cash',
          ref: 'OPENING',
          debit: 450,
          credit: 0,
          description: 'GM opening cash',
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toBe('Opening balance entry saved');
    expect(
      mockPrisma.generalMerchandiseAccountingOpeningBalance.create
    ).toHaveBeenCalledWith({
      data: expect.objectContaining({
        date: new Date('2026-01-17T00:00:00.000Z'),
        account: 'Cash',
        debit: 450,
        credit: 0,
      }),
    });
  });

  it('returns an empty list for GET when the GM opening balance model is unavailable', async () => {
    delete (
      mockPrisma as { generalMerchandiseAccountingOpeningBalance?: unknown }
    ).generalMerchandiseAccountingOpeningBalance;

    const { GET } = await import(
      '@/app/api/general-merchandise/accounting/opening-balance/route'
    );

    const response = await GET(
      buildRequest('/api/general-merchandise/accounting/opening-balance')
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.entries).toEqual([]);

    mockPrisma.generalMerchandiseAccountingOpeningBalance = {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
  });
});
