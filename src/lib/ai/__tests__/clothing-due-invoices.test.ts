import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as StoreModule from '../store';
const mock = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock('@/lib/db', () => ({
  prisma: { transaction: { findMany: mock.findMany } },
}));
vi.mock('../settings', () => ({
  ensureAiAssistantTables: vi.fn(),
  getAiAssistantSettings: vi.fn(async () => ({
    activeProvider: 'ollama',
    activeModel: 'test',
    allowCloudDataSharing: false,
    dailyTokenLimit: 1000000,
    monthlyBudgetUsd: 15,
    usage: { todayTotalTokens: 0, monthEstimatedCostUsd: 0 },
  })),
}));
vi.mock('../store', async (importOriginal) => ({
  ...(await importOriginal<typeof StoreModule>()),
  insertAuditLogToStore: vi.fn(),
}));
import {
  getClothingDueInvoices,
  formatClothingDueInvoices,
} from '../tools/clothing-due-invoices';
import { runBusinessAiAssistant } from '../orchestrator';

describe('Clothing Prepared invoice deadlines', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-30T21:53:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  it('finds Crista using the board cutoff while excluding A/R even with a past stored date', async () => {
    mock.findMany.mockResolvedValue([
      {
        id: 3608,
        customers: 'Crista | Stang Rosete',
        productCode: 'Mixed Onesie (MO-062626)',
        orderStatus: 'Prepared',
        lineTotal: 1410,
        invoiceDate: '2026-10-22T07:49:08.721Z',
        quantity: 30,
        unitPrice: 47,
      },
      {
        id: 3609,
        customers: 'Trusted customer',
        productCode: 'X',
        orderStatus: 'Accounts Receivable',
        lineTotal: 100,
        invoiceDate: '2026-01-01',
        accountsReceivableDueAt: new Date('2026-02-01'),
      },
      {
        id: 3610,
        customers: 'Paid customer',
        orderStatus: 'Prepared',
        lineTotal: 0,
        invoiceDate: '2026-01-01',
      },
      {
        id: 3611,
        customers: 'Invalid date',
        orderStatus: 'Prepared',
        lineTotal: 100,
        invoiceDate: 'not-a-date',
      },
    ]);
    const rows = await mock.findMany();
    mock.findMany.mockResolvedValue([
      ...rows,
      {
        id: 3612,
        customers: 'Legacy trusted customer',
        orderStatus: 'Pending Payment',
        lineTotal: 100,
        invoiceDate: '2026-01-01',
        accountsReceivableDueAt: new Date('2026-02-01'),
      },
    ]);
    mock.findMany.mockClear();
    const result = await getClothingDueInvoices('overdue', 30, new Date());
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      customer: 'Crista | Stang Rosete',
      remainingBalance: 1410,
      dueDate: '2026-10-25',
      dueAt: '2026-10-25T15:59:59.999Z',
      dueInHours: -126,
      isOverdue: true,
    });
    expect(formatClothingDueInvoices(result)).toContain(
      'Mixed Onesie (MO-062626)'
    );
    expect(formatClothingDueInvoices(result)).toContain('PHP 1,410.00');
    expect(formatClothingDueInvoices(result)).toContain(
      'no automatic deadline'
    );
    expect(mock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          orderStatus: 'Prepared',
          lineTotal: { gt: 0 },
          invoiceDate: { not: null },
        },
      })
    );
  });
  it('filters due dates before limiting and separates coming invoices', async () => {
    mock.findMany.mockResolvedValue([
      {
        id: 1,
        customers: 'Upcoming',
        orderStatus: 'Prepared',
        lineTotal: 100,
        invoiceDate: '2026-10-30',
      },
      {
        id: 2,
        customers: 'Overdue',
        orderStatus: 'Prepared',
        lineTotal: 200,
        invoiceDate: '2026-10-22',
      },
    ]);
    expect(
      (await getClothingDueInvoices('overdue', 1, new Date())).items[0].customer
    ).toBe('Overdue');
    expect(
      (await getClothingDueInvoices('upcoming', 1, new Date())).items[0]
        .customer
    ).toBe('Upcoming');
  });
  it('treats the exact cutoff as current and becomes overdue one millisecond later', async () => {
    mock.findMany.mockResolvedValue([
      {
        id: 1,
        customers: 'Cutoff',
        orderStatus: 'Prepared',
        lineTotal: 100,
        invoiceDate: '2026-10-22',
      },
    ]);
    expect(
      (
        await getClothingDueInvoices(
          'overdue',
          30,
          new Date('2026-10-25T15:59:59.999Z')
        )
      ).items
    ).toHaveLength(0);
    expect(
      (
        await getClothingDueInvoices(
          'overdue',
          30,
          new Date('2026-10-25T16:00:00.000Z')
        )
      ).items
    ).toHaveLength(1);
  });
  it.each([
    'List customers with past due dates',
    'List customers with due dates coming',
  ])('answers the exact suggestion directly: %s', async (question) => {
    mock.findMany.mockResolvedValue([
      {
        id: 1,
        customers: 'Crista | Stang Rosete',
        orderStatus: 'Prepared',
        lineTotal: 1410,
        invoiceDate: '2026-10-22',
        productCode: 'Mixed Onesie (MO-062626)',
      },
      {
        id: 2,
        customers: 'Upcoming',
        orderStatus: 'Prepared',
        lineTotal: 100,
        invoiceDate: '2026-10-30',
        productCode: 'X',
      },
    ]);
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Cloud must not run'));
    try {
      const result = await runBusinessAiAssistant({
        userPrompt: question,
        businessUnit: 'clothing',
        triggerSource: 'USER_CHAT',
        toolContext: {
          userId: 'admin',
          userRole: 'SUPER_ADMIN',
          accessibleModules: [],
          allowedBusinessUnits: ['clothing'],
        },
      });
      expect(result.model).toBe('deterministic-clothing-due-invoices');
      expect(result.inputTokens + result.outputTokens).toBe(0);
      expect(result.text).toContain(
        question.includes('past') ? 'Crista' : 'Upcoming'
      );
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });
  it('surfaces a failed due lookup without replacing it with another provider or recurring dues', async () => {
    mock.findMany.mockRejectedValue(new Error('Database unavailable'));
    await expect(
      runBusinessAiAssistant({
        userPrompt: 'List customers with past due dates',
        businessUnit: 'clothing',
        triggerSource: 'USER_CHAT',
        toolContext: {
          userId: 'admin',
          userRole: 'SUPER_ADMIN',
          accessibleModules: [],
          allowedBusinessUnits: ['clothing'],
        },
      })
    ).rejects.toThrow(
      'Could not complete the Clothing invoice due-date lookup'
    );
  });
});
