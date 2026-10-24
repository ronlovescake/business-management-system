import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('@/lib/auth/session', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'test-admin', role: 'ADMIN' })),
}));
import { getTestApiUrl } from '@/core/testing/test-helpers';
import { Prisma } from '@prisma/client';
import { investorPostingLines } from '@/lib/investors/accounting';
import { getTransactionPaymentDebitAccount } from '@/lib/accounting/transaction-recognition';

const {
  mockFetchers,
  mockPrisma,
  mockBuildCogsAndInventoryEntries,
  mockBuildInventorySeedAndShrinkageEntries,
} = vi.hoisted(() => {
  return {
    mockFetchers: {
      fetchPaidTransactions: vi.fn(),
      fetchTransactionPayments: vi.fn(),
      fetchApprovedExpenses: vi.fn(),
      fetchManualJournalLines: vi.fn(),
      fetchTransactionRefunds: vi.fn(),
      getPaidAtDate: vi.fn(),
      getCancelledAtDate: vi.fn(),
    },
    mockPrisma: {
      clothingInventoryReclassEntry: {
        findMany: vi.fn(),
      },
      clothingInventoryTransitBuildEntry: {
        findMany: vi.fn(),
      },
      transaction: {
        findMany: vi.fn(),
      },
    },
    mockBuildCogsAndInventoryEntries: vi.fn(),
    mockBuildInventorySeedAndShrinkageEntries: vi.fn(),
  };
});

vi.mock('@/lib/accounting/data-fetchers', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;

  return {
    ...actual,
    fetchPaidTransactions: mockFetchers.fetchPaidTransactions,
    fetchTransactionPayments: mockFetchers.fetchTransactionPayments,
    fetchApprovedExpenses: mockFetchers.fetchApprovedExpenses,
    fetchManualJournalLines: mockFetchers.fetchManualJournalLines,
    fetchTransactionRefunds: mockFetchers.fetchTransactionRefunds,
    getPaidAtDate: mockFetchers.getPaidAtDate,
    getCancelledAtDate: mockFetchers.getCancelledAtDate,
  };
});

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;

  return {
    ...actual,
    prisma: mockPrisma,
  };
});

vi.mock('@/lib/accounting/inventory-cogs', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;

  return {
    ...actual,
    buildCogsAndInventoryEntries: mockBuildCogsAndInventoryEntries,
    buildInventorySeedAndShrinkageEntries:
      mockBuildInventorySeedAndShrinkageEntries,
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
    mockFetchers.fetchManualJournalLines.mockResolvedValue([]);
    mockFetchers.fetchTransactionRefunds.mockResolvedValue([]);

    mockPrisma.clothingInventoryReclassEntry.findMany.mockResolvedValue([]);
    mockPrisma.clothingInventoryTransitBuildEntry.findMany.mockResolvedValue(
      []
    );
    mockPrisma.transaction.findMany.mockResolvedValue([]);
    mockBuildCogsAndInventoryEntries.mockResolvedValue({
      entries: [],
      totalCogs: 0,
    });

    mockBuildInventorySeedAndShrinkageEntries.mockResolvedValue({
      entries: [],
      seedTotal: 0,
      shrinkageTotal: 0,
    });

    // Keep date logic predictable for legacy transactions.
    mockFetchers.getPaidAtDate.mockImplementation(
      (tx: { orderDate?: string }) => {
        return tx.orderDate ? new Date(`${tx.orderDate}T00:00:00.000Z`) : null;
      }
    );

    mockFetchers.getCancelledAtDate.mockImplementation((tx: unknown) => {
      const typed = tx as {
        statusChanges?: { newStatus: string | null; changedAt: Date }[];
        updatedAt?: Date;
      };
      return typed.statusChanges?.[0]?.changedAt ?? typed.updatedAt ?? null;
    });
  });

  it('includes balanced investor movements with their source references', async () => {
    mockFetchers.fetchPaidTransactions.mockResolvedValue([]);
    mockFetchers.fetchTransactionPayments.mockResolvedValue([]);
    const lines = (['funding', 'return', 'repayment'] as const).flatMap(
      (kind) =>
        investorPostingLines({
          kind,
          agreementId: 'agreement',
          reference: 'CR-001',
          sourceId: kind === 'return' ? 'payment' : 'agreement',
          amount: new Prisma.Decimal(kind === 'return' ? '50000' : '1000000'),
          date: '2026-04-28',
          cutover: new Date('2026-01-17T00:00:00Z'),
        }).map((line) => ({ ...line, id: `${kind}-${line.sourceLineKey}` }))
    );
    mockFetchers.fetchManualJournalLines.mockResolvedValue(lines);
    const response = await GET(
      buildRequest('/api/accounting/journal?from=2026-04-01&to=2026-04-30')
    );
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data.entries).toHaveLength(6);
    for (const line of lines) {
      expect(payload.data.entries).toContainEqual(
        expect.objectContaining({
          id: line.id,
          account: line.account,
          debit: line.debit,
          credit: line.credit,
          sourceType: line.sourceType,
          sourceId: line.sourceId,
          systemGenerated: true,
        })
      );
    }
    expect(payload.data.stats.totalDebits).toBe(2050000);
    expect(payload.data.stats.totalCredits).toBe(2050000);
    expect(payload.data.stats.netChange).toBe(0);
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
        orderDate: '2026-01-20',
      },
      {
        id: 2,
        productCode: 'P-200',
        customers: 'Bob',
        quantity: 1,
        unitPrice: 75,
        adjustment: 75,
        orderDate: '2026-01-20',
      },
    ]);

    mockFetchers.fetchTransactionPayments.mockResolvedValue([
      {
        id: 10,
        transactionId: 1,
        paymentDate: '2026-01-22',
        amount: 50,
        method: 'cash',
        notes: 'partial',
        transaction: {
          productCode: 'P-100',
          customers: 'Alice',
        },
      },
    ]);

    mockBuildInventorySeedAndShrinkageEntries.mockResolvedValue({
      entries: [
        {
          id: 'INV-SEED-2026-01-02-inventory-debit',
          date: '2026-01-02T00:00:00.000Z',
          ref: 'INV-SEED-2026-01-02',
          account: 'Stock on Hand',
          debit: 10,
          credit: 0,
          description: 'seed',
        },
        {
          id: 'INV-SEED-2026-01-02-opening-equity-credit',
          date: '2026-01-02T00:00:00.000Z',
          ref: 'INV-SEED-2026-01-02',
          account: 'Opening Equity',
          debit: 0,
          credit: 10,
          description: 'seed offset',
        },
      ],
      seedTotal: 10,
      shrinkageTotal: 0,
    });

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

    // Inventory seed/shrinkage derived entries are included.
    expect(
      entries.some((e) => e.id === 'INV-SEED-2026-01-02-inventory-debit')
    ).toBe(true);
  });

  it('debits the recorded payment account for A/R collections', async () => {
    mockFetchers.fetchPaidTransactions.mockResolvedValue([]);
    const payment = {
      id: 44,
      transactionId: 44,
      paymentDate: '2026-01-22',
      amount: 75,
      method: 'Bank Transfer',
      notes: null,
      isReservation: false,
      transaction: {
        id: 44,
        productCode: 'AR-44',
        customers: 'Customer A',
        orderDate: '2026-01-20',
        orderStatus: 'Accounts Receivable',
        shippedAt: new Date('2026-01-20T00:00:00.000Z'),
        statusChanges: [],
      },
    };
    expect(getTransactionPaymentDebitAccount(payment)).toBe('Bank');
    mockFetchers.fetchTransactionPayments.mockResolvedValue([payment]);

    const response = await GET(
      buildRequest('/api/accounting/journal?from=2026-01-01&to=2026-01-31')
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.entries).toContainEqual(
      expect.objectContaining({
        id: 'PM-44-cash',
        account: 'Bank',
        debit: 75,
        credit: 0,
      })
    );
    expect(payload.data.entries).toContainEqual(
      expect.objectContaining({
        id: 'PM-44-receivable',
        account: 'Accounts Receivable',
        debit: 0,
        credit: 75,
      })
    );
    expect(
      payload.data.entries.some(
        (entry: { id: string; account: string }) =>
          entry.id === 'PM-44-cash' && entry.account === 'Cash'
      )
    ).toBe(false);
  });

  it('posts reservation payments to Customer Deposits and reclasses to Sales Revenue when paid', async () => {
    mockFetchers.fetchPaidTransactions.mockResolvedValue([
      {
        id: 1,
        productCode: 'P-100',
        customers: 'Alice',
        quantity: 1,
        unitPrice: 100,
        adjustment: 100,
        orderDate: '2026-01-20',
        orderStatus: 'Checked Out',
      },
    ]);

    mockFetchers.fetchTransactionPayments.mockResolvedValue([
      {
        id: 10,
        transactionId: 1,
        // Must be post-cutover (2026-01-17) because the route clamps `from`.
        paymentDate: '2026-01-18',
        amount: 50,
        method: 'cash',
        notes: 'reservation',
        isReservation: true,
        transaction: {
          productCode: 'P-100',
          customers: 'Alice',
          orderStatus: 'Checked Out',
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

    // Deposit receipt
    expect(entries.some((e) => e.id === 'PM-10-cash')).toBe(true);
    expect(entries.some((e) => e.id === 'PM-10-deposits')).toBe(true);
    expect(entries.some((e) => e.id === 'PM-10-sales')).toBe(false);

    // Reclass upon paid status
    const debit = entries.find((e) => e.id === 'DEP-REVENUE-TX-1-debit');
    const credit = entries.find((e) => e.id === 'DEP-REVENUE-TX-1-credit');
    expect(debit?.account).toBe('Customer Deposits');
    expect(debit?.debit).toBe(50);
    expect(credit?.account).toBe('Sales Revenue');
    expect(credit?.credit).toBe(50);
  });

  it('reclasses reservation deposits to Forfeited Deposits when forfeited', async () => {
    mockFetchers.fetchPaidTransactions.mockResolvedValue([]);

    mockFetchers.fetchTransactionPayments.mockResolvedValue([
      {
        id: 11,
        transactionId: 2,
        // Must be post-cutover (2026-01-17) because the route clamps `from`.
        paymentDate: '2026-01-18',
        amount: 75,
        method: 'cash',
        notes: 'reservation',
        isReservation: true,
        transaction: {
          productCode: 'P-200',
          customers: 'Bob',
          orderStatus: 'Forfeited',
        },
      },
    ]);

    mockPrisma.transaction.findMany.mockResolvedValue([
      {
        id: 2,
        updatedAt: new Date('2026-01-22T00:00:00.000Z'),
        statusChanges: [
          {
            newStatus: 'Forfeited',
            changedAt: new Date('2026-01-18T00:00:00.000Z'),
          },
        ],
      },
    ]);

    mockFetchers.getCancelledAtDate.mockReturnValue(
      new Date('2026-01-18T00:00:00.000Z')
    );

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

    // Deposit receipt
    expect(entries.some((e) => e.id === 'PM-11-deposits')).toBe(true);

    // Reclass upon forfeiture
    const debit = entries.find((e) => e.id === 'DEP-FORFEIT-TX-2-debit');
    const credit = entries.find((e) => e.id === 'DEP-FORFEIT-TX-2-credit');
    expect(debit?.account).toBe('Customer Deposits');
    expect(debit?.debit).toBe(75);
    expect(credit?.account).toBe('Forfeited Deposits');
    expect(credit?.credit).toBe(75);
  });

  it('refunds a voided reservation against Customer Deposits, not Sales Returns', async () => {
    mockFetchers.fetchPaidTransactions.mockResolvedValue([]);
    mockFetchers.fetchTransactionPayments.mockResolvedValue([
      {
        id: 45,
        transactionId: 44,
        paymentDate: '2026-01-20',
        amount: 30,
        method: 'Cash',
        isReservation: true,
        transaction: {
          id: 44,
          productCode: 'SKU-44',
          customers: 'Customer Void',
          orderDate: '2026-01-18',
          orderStatus: 'Voided',
        },
      },
    ]);
    mockFetchers.fetchTransactionRefunds.mockResolvedValue([
      {
        id: 99,
        transactionId: 44,
        refundDate: '2026-01-21',
        amount: 30,
        reason: 'Supplier unavailable',
        notes: null,
        createdAt: new Date('2026-01-21T00:00:00.000Z'),
        transaction: {
          id: 44,
          customers: 'Customer Void',
          productCode: 'SKU-44',
          orderStatus: 'Voided',
          payments: [{ amount: 30 }],
        },
      },
    ]);

    const response = await GET(
      buildRequest('/api/accounting/journal?from=2026-01-01&to=2026-01-31')
    );
    const payload = await response.json();
    const entries = payload.data.entries as Array<{
      id: string;
      account: string;
      debit: number;
      credit: number;
    }>;

    expect(entries).toContainEqual(
      expect.objectContaining({
        id: 'RF-99-refund-debit',
        ref: 'VOID-REFUND-TX-44',
        account: 'Customer Deposits',
        debit: 30,
        credit: 0,
        description: expect.stringContaining(
          'Voided reservation refund • Customer Void'
        ),
      })
    );
    expect(
      entries.some((entry) => entry.id === 'DEP-REVENUE-TX-44-credit')
    ).toBe(false);
    expect(entries.some((entry) => entry.account === 'Sales Returns')).toBe(
      false
    );
  });
});
