import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getTestApiUrl } from '@/core/testing/test-helpers';

const { mockFetchers, mockBuildCogsAndInventoryEntries } = vi.hoisted(() => {
  return {
    mockFetchers: {
      fetchPaidTransactions: vi.fn(),
      fetchTransactionPayments: vi.fn(),
      fetchApprovedExpenses: vi.fn(),
      fetchTransactionRefunds: vi.fn(),
      getPaidAtDate: vi.fn(),
    },
    mockBuildCogsAndInventoryEntries: vi.fn(),
  };
});

vi.mock('@/lib/accounting/data-fetchers', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;

  return {
    ...actual,
    fetchPaidTransactions: mockFetchers.fetchPaidTransactions,
    fetchTransactionPayments: mockFetchers.fetchTransactionPayments,
    fetchApprovedExpenses: mockFetchers.fetchApprovedExpenses,
    fetchTransactionRefunds: mockFetchers.fetchTransactionRefunds,
    getPaidAtDate: mockFetchers.getPaidAtDate,
  };
});

vi.mock('@/lib/accounting/inventory-cogs', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;

  return {
    ...actual,
    buildCogsAndInventoryEntries: mockBuildCogsAndInventoryEntries,
  };
});

import { GET } from '@/app/api/accounting/journal/route';

type NextRequestInit = ConstructorParameters<typeof NextRequest>[1];

const buildRequest = (path: string, init?: NextRequestInit) =>
  new NextRequest(getTestApiUrl(path), init);

describe('Accounting Journal API - GET /api/accounting/journal', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockFetchers.fetchApprovedExpenses.mockResolvedValue([]);
    mockFetchers.fetchTransactionRefunds.mockResolvedValue([]);
    mockBuildCogsAndInventoryEntries.mockResolvedValue({
      entries: [],
      totalCogs: 0,
    });

    // Keep date logic predictable for legacy transactions.
    mockFetchers.getPaidAtDate.mockImplementation(
      (tx: { orderDate?: string }) => {
        return tx.orderDate ? new Date(`${tx.orderDate}T00:00:00.000Z`) : null;
      }
    );
  });

  it('uses payment events and suppresses legacy cash entries for the same transaction', async () => {
    mockFetchers.fetchPaidTransactions.mockResolvedValue([
      {
        id: 1,
        productCode: 'P-100',
        customers: 'Alice',
        quantity: 1,
        unitPrice: 100,
        adjustment: 100,
        orderDate: '2026-01-05',
      },
      {
        id: 2,
        productCode: 'P-200',
        customers: 'Bob',
        quantity: 1,
        unitPrice: 75,
        adjustment: 75,
        orderDate: '2026-01-05',
      },
    ]);

    mockFetchers.fetchTransactionPayments.mockResolvedValue([
      {
        id: 10,
        transactionId: 1,
        paymentDate: '2026-01-10',
        amount: 50,
        method: 'cash',
        notes: 'partial',
        transaction: {
          productCode: 'P-100',
          customers: 'Alice',
        },
      },
    ]);

    const res = await GET(
      buildRequest('/api/accounting/journal?from=2026-01-01&to=2026-01-31')
    );

    expect(res.status).toBe(200);

    const payload = await res.json();
    expect(payload.success).toBe(true);

    const entries: Array<{
      id: string;
      account: string;
      debit: number;
      credit: number;
    }> = payload.data.entries;

    // Payment event entries exist.
    expect(entries.some((e) => e.id === 'PM-10-cash')).toBe(true);
    expect(entries.some((e) => e.id === 'PM-10-sales')).toBe(true);

    // Legacy tx entries should be suppressed for TX-1 when payment events exist.
    expect(entries.some((e) => e.id === 'TX-1-cash')).toBe(false);
    expect(entries.some((e) => e.id === 'TX-1-sales')).toBe(false);

    // Legacy tx entries still exist for TX-2 (no payments).
    expect(entries.some((e) => e.id === 'TX-2-cash')).toBe(true);
    expect(entries.some((e) => e.id === 'TX-2-sales')).toBe(true);

    // Sanity: most recent (payment) should sort ahead of legacy entries.
    expect(entries[0]?.id.startsWith('PM-')).toBe(true);
  });
});
