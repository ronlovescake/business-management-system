import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  $executeRawUnsafe: vi.fn().mockResolvedValue(0),
  $queryRawUnsafe: vi.fn().mockResolvedValue([]),
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  accountingSettings: {
    findFirst: vi.fn().mockResolvedValue(null),
  },
  customer: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  transactionPayment: {
    findMany: vi.fn(),
  },
  transactionRefund: {
    findMany: vi.fn(),
  },
  expense: {
    findMany: vi.fn(),
  },
  clothingAccountingOpeningBalance: {
    findMany: vi.fn(),
  },
  clothingAccountingJournalLine: {
    findMany: vi.fn(),
  },
  clothingOrderCancellation: {
    findMany: vi.fn(),
  },
  aiAssistantSetting: {
    upsert: vi.fn(),
  },
  aiAuditLog: {
    aggregate: vi.fn(),
    create: vi.fn(),
  },
  aiMonitoringAlert: {
    upsert: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  transaction: {
    findMany: vi.fn(),
  },
  generalMerchandiseTransaction: {
    findMany: vi.fn(),
  },
  truckingInvoice: {
    findMany: vi.fn(),
  },
  clothingRecurringPaymentTemplate: {
    findMany: vi.fn(),
  },
  generalMerchandiseRecurringPaymentTemplate: {
    findMany: vi.fn(),
  },
  product: {
    findMany: vi.fn(),
  },
  generalMerchandiseProduct: {
    findMany: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

import {
  READ_ONLY_BUSINESS_TOOLS,
  runBusinessAiAssistant,
  runDeterministicBusinessMonitor,
} from '../index';
import { collectDeterministicAnomalies } from '../monitors';
import {
  autoResolveStaleAlertsInStore,
  getOpenClothingTransactionAlertsInStore,
} from '../store';

describe('AI Business Assistant — Safety, RBAC & Deterministic Monitoring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$queryRaw.mockResolvedValue([]);
    mockPrisma.$executeRaw.mockResolvedValue(0);
    for (const model of [
      mockPrisma.transaction,
      mockPrisma.generalMerchandiseTransaction,
      mockPrisma.truckingInvoice,
      mockPrisma.clothingRecurringPaymentTemplate,
      mockPrisma.generalMerchandiseRecurringPaymentTemplate,
      mockPrisma.product,
      mockPrisma.generalMerchandiseProduct,
      mockPrisma.aiMonitoringAlert,
      mockPrisma.customer,
      mockPrisma.transactionPayment,
      mockPrisma.transactionRefund,
      mockPrisma.expense,
      mockPrisma.clothingAccountingOpeningBalance,
      mockPrisma.clothingAccountingJournalLine,
      mockPrisma.clothingOrderCancellation,
    ]) {
      model.findMany.mockResolvedValue([]);
    }
    mockPrisma.customer.count.mockResolvedValue(0);
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]);
    mockPrisma.$transaction.mockImplementation(
      async (
        fn: (tx: {
          $executeRawUnsafe: typeof mockPrisma.$executeRawUnsafe;
          $queryRawUnsafe: typeof mockPrisma.$queryRawUnsafe;
        }) => Promise<unknown>
      ) =>
        fn({
          $executeRawUnsafe: mockPrisma.$executeRawUnsafe,
          $queryRawUnsafe: mockPrisma.$queryRawUnsafe,
        })
    );

    mockPrisma.aiAuditLog.aggregate.mockResolvedValue({
      _sum: { inputTokens: 1200, outputTokens: 400, estimatedCostUsd: 0 },
      _count: { id: 2 },
    });

    mockPrisma.aiAssistantSetting.upsert.mockResolvedValue({
      id: 'setting-1',
      key: 'default',
      activeProvider: 'ollama',
      activeModel: 'qwen3:8b',
      accountingModel: null,
      ollamaBaseUrl: 'http://host.docker.internal:11434',
      fallbackProvider: null,
      fallbackModel: null,
      allowCloudDataSharing: false,
      dailyTokenLimit: 250000,
      monthlyBudgetUsd: 15.0,
      monitoringEnabled: true,
      morningBriefingEnabled: true,
      morningBriefingTime: '07:00',
      timezone: 'Asia/Manila',
      updatedAt: new Date('2026-10-30T10:00:00Z'),
      updatedByUserId: 'admin-1',
    });
  });

  it('forwards multi-turn chat history to the provider in order', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Follow-up answer' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      const result = await runBusinessAiAssistant({
        userPrompt: 'And which one is the largest?',
        history: [
          { role: 'user', content: 'Show overdue invoices' },
          { role: 'assistant', content: 'There are 3 overdue invoices.' },
        ],
        triggerSource: 'USER_CHAT',
        enableTools: false,
        toolContext: {
          userId: 'admin-1',
          userRole: 'SUPER_ADMIN',
          accessibleModules: [],
          allowedBusinessUnits: ['clothing'],
        },
      });

      expect(result.text).toBe('Follow-up answer');
      const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
        messages: Array<{ role: string; content: string }>;
      };
      expect(body.messages.map((m) => m.role)).toEqual([
        'system',
        'user',
        'assistant',
        'user',
      ]);
      expect(body.messages[3].content).toBe('And which one is the largest?');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it.each([4, -4, 10, -10])(
    'uses net clothing prices with discount %s',
    async (discount) => {
      mockPrisma.transaction.findMany.mockResolvedValue([
        {
          id: 3607,
          quantity: 30,
          unitPrice: 22,
          discount,
          adjustment: 660,
          lineTotal: 0,
          orderStatus: 'Shipped',
        },
      ]);
      expect(await collectDeterministicAnomalies()).toEqual([]);
    }
  );

  it.each(['Cancelled', 'Voided', 'Forfeited'])(
    'checks closed %s balances without open receivables',
    async (orderStatus) => {
      mockPrisma.transaction.findMany.mockResolvedValue([
        {
          id: 3673,
          quantity: 10,
          unitPrice: 290,
          adjustment: 580,
          lineTotal: 0,
          orderStatus,
        },
        {
          id: 3677,
          quantity: 3,
          unitPrice: 290,
          adjustment: 174,
          lineTotal: 696,
          orderStatus,
          accountsReceivableDueAt: new Date('2020-01-01'),
        },
      ]);
      const anomalies = await collectDeterministicAnomalies();
      expect(anomalies).toHaveLength(1);
      expect(anomalies[0].dedupeKey).toBe(
        'clothing:cancelled-nonzero-balance:3677'
      );
      expect(anomalies[0].severity).toBe('CRITICAL');
    }
  );

  it('monitors Prepared invoice cutoffs but never declares trusted A/R overdue', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([
      {
        id: 3608,
        customers: 'Crista | Stang Rosete',
        productCode: 'Mixed Onesie (MO-062626)',
        quantity: 30,
        unitPrice: 47,
        adjustment: 0,
        lineTotal: 1410,
        invoiceDate: '2026-10-22T07:49:08.721Z',
        orderStatus: 'Prepared',
        accountsReceivableDueAt: null,
      },
      {
        id: 3609,
        customers: 'Trusted customer',
        productCode: 'X',
        quantity: 1,
        unitPrice: 100,
        adjustment: 0,
        lineTotal: 100,
        invoiceDate: '2026-01-01',
        orderStatus: 'Accounts Receivable',
        accountsReceivableDueAt: new Date('2020-01-01'),
      },
    ]);
    const anomalies = await collectDeterministicAnomalies();
    expect(
      anomalies.filter((entry) => entry.category === 'INVOICE_OVERDUE')
    ).toEqual([
      expect.objectContaining({
        dedupeKey: 'clothing:overdue-receivable:3608',
        sourceLink: '/clothing/operations/due-dates',
      }),
    ]);
  });

  it('detects deterministic accounting mismatches across business units and deduplicates alerts', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([
      {
        id: 1042,
        customers: 'Reseller Alpha',
        productCode: 'BALE-01',
        quantity: 1,
        unitPrice: 10000,
        discount: 0,
        adjustment: 8000,
        lineTotal: 2000,
        orderStatus: 'Paid',
        accountsReceivableDueAt: null,
      },
    ]);
    mockPrisma.generalMerchandiseTransaction.findMany.mockResolvedValue([]);
    mockPrisma.truckingInvoice.findMany.mockResolvedValue([
      {
        id: 'trk-inv-99',
        status: 'PAID',
        totalAmount: 15000,
        dueDate: null,
        customer: { customerName: 'Logistics Client B' },
        allocations: [{ amount: 12000 }],
      },
    ]);
    mockPrisma.clothingRecurringPaymentTemplate.findMany.mockResolvedValue([]);
    mockPrisma.generalMerchandiseRecurringPaymentTemplate.findMany.mockResolvedValue(
      []
    );
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.generalMerchandiseProduct.findMany.mockResolvedValue([]);
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        id: 'stale-alert-1',
        dedupeKey: 'clothing:line-formula-mismatch:1042',
        evidenceJson: { transactionId: 1042 },
        updatedAtToken: '1790812800.123456',
      },
    ]);
    mockPrisma.$executeRaw.mockResolvedValue(1);

    const summary = await runDeterministicBusinessMonitor();

    expect(summary.detectedCount).toBe(2);
    expect(summary.byBusinessUnit.clothing).toBe(1);
    expect(summary.byBusinessUnit.trucking).toBe(1);
    expect(summary.autoResolvedCount).toBe(1);
    expect(mockPrisma.aiMonitoringAlert.upsert).toHaveBeenCalledTimes(2);
  });

  it.each(['clothing', 'general-merchandise'] as const)(
    'preserves %s pricing in the AI tool',
    async (businessUnit) => {
      const row = {
        id: 1,
        quantity: 30,
        unitPrice: 22,
        discount: -4,
        adjustment: 660,
        lineTotal: 0,
        orderStatus: 'Shipped',
      };
      mockPrisma.transaction.findMany.mockResolvedValue([row]);
      mockPrisma.generalMerchandiseTransaction.findMany.mockResolvedValue([
        row,
      ]);
      const tool = READ_ONLY_BUSINESS_TOOLS.find(
        (item) => item.name === 'getAccountingDiscrepancies'
      );
      if (!tool) {
        throw new Error('Accounting tool missing');
      }
      const result = await tool.execute(
        { businessUnit },
        {
          userId: 'admin',
          userRole: 'ADMIN',
          accessibleModules: [],
          allowedBusinessUnits: [businessUnit],
        }
      );
      expect(result).toMatchObject({
        anomalyCount: businessUnit === 'clothing' ? 0 : 1,
      });
    }
  );

  it.each(['Cancelled', 'Voided', 'Forfeited'])(
    'checks %s residual balances in the AI tool',
    async (orderStatus) => {
      mockPrisma.transaction.findMany.mockResolvedValue([
        {
          id: 1,
          quantity: 10,
          unitPrice: 290,
          adjustment: 580,
          lineTotal: 0,
          orderStatus,
        },
        {
          id: 2,
          quantity: 10,
          unitPrice: 290,
          adjustment: 580,
          lineTotal: 2320,
          orderStatus,
        },
      ]);
      const tool = READ_ONLY_BUSINESS_TOOLS.find(
        (item) => item.name === 'getAccountingDiscrepancies'
      );
      if (!tool) {
        throw new Error('Accounting tool missing');
      }
      expect(
        await tool.execute(
          { businessUnit: 'clothing' },
          {
            userId: 'admin',
            userRole: 'ADMIN',
            accessibleModules: [],
            allowedBusinessUnits: ['clothing'],
          }
        )
      ).toMatchObject({ anomalyCount: 1, anomalies: [{ transactionId: 2 }] });
    }
  );

  it('preserves the general merchandise discount formula in the monitor', async () => {
    mockPrisma.generalMerchandiseTransaction.findMany.mockResolvedValue([
      {
        id: 1,
        quantity: 2,
        unitPrice: 100,
        discount: 10,
        adjustment: 0,
        lineTotal: 190,
        orderStatus: 'Warehouse',
      },
    ]);
    expect(await collectDeterministicAnomalies()).toEqual([]);
  });

  it('retains the #3395 critical anomaly and complete pricing evidence', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([
      {
        id: 3395,
        quantity: 150,
        unitPrice: 54,
        discount: 0,
        adjustment: 15390,
        lineTotal: -7290,
        orderStatus: 'Shipped',
      },
    ]);
    expect(await collectDeterministicAnomalies()).toMatchObject([
      {
        dedupeKey: 'clothing:paid-nonzero-balance:3395',
        severity: 'CRITICAL',
        evidenceJson: {
          quantity: 150,
          unitPrice: 54,
          discount: 0,
          orderStatus: 'Shipped',
          lineTotal: -7290,
        },
      },
    ]);
  });

  it.each([0, 20])(
    're-fetches old referenced alerts and resolves only cleared balances (%s)',
    async (lineTotal) => {
      const updatedAtToken = '1790812800.123456';
      mockPrisma.$queryRaw.mockResolvedValue([
        {
          id: 'old',
          dedupeKey: 'clothing:line-formula-mismatch:1',
          evidenceJson: { transactionId: 1 },
          updatedAtToken,
        },
      ]);
      mockPrisma.transaction.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 1,
            quantity: 1,
            unitPrice: 100,
            adjustment: 100,
            lineTotal,
            orderStatus: 'Warehouse',
          },
        ]);
      mockPrisma.$executeRaw.mockResolvedValue(1);
      const result = await runDeterministicBusinessMonitor();
      expect(mockPrisma.transaction.findMany).toHaveBeenNthCalledWith(2, {
        where: { deletedAt: null, id: { in: [1] } },
      });
      expect(result.autoResolvedCount).toBe(lineTotal === 0 ? 1 : 0);
      if (lineTotal === 0) {
        expect(mockPrisma.$executeRaw.mock.calls[0]).toContain(updatedAtToken);
      } else {
        expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
      }
    }
  );

  it('preserves missing records, unsupported keys and malformed evidence', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        id: 'missing',
        dedupeKey: 'clothing:line-formula-mismatch:1',
        evidenceJson: { transactionId: 1 },
      },
      {
        id: 'bad',
        dedupeKey: 'clothing:line-formula-mismatch:2',
        evidenceJson: {},
      },
      {
        id: 'other',
        dedupeKey: 'clothing:recurring-due:2',
        evidenceJson: { transactionId: 2 },
      },
    ]);
    expect((await runDeterministicBusinessMonitor()).autoResolvedCount).toBe(0);
    expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
    expect(mockPrisma.$queryRaw.mock.calls[0][0].join('')).toContain(
      "status = 'OPEN' AND \"businessUnit\" = 'clothing'"
    );
  });

  it('does not resolve anything after a failed scan', async () => {
    mockPrisma.transaction.findMany.mockRejectedValueOnce(
      new Error('query failed')
    );
    await expect(runDeterministicBusinessMonitor()).rejects.toThrow(
      'query failed'
    );
    expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
  });

  it('keeps concurrently refreshed candidates and supports the SQL fallback', async () => {
    const candidate = {
      id: 'old',
      dedupeKey: 'clothing:line-formula-mismatch:1',
      evidenceJson: { transactionId: 1 },
      updatedAtToken: '1790812800.123456',
    };
    mockPrisma.$executeRaw.mockResolvedValue(0);
    expect(await autoResolveStaleAlertsInStore([candidate], new Date())).toBe(
      0
    );
    mockPrisma.$executeRaw.mockClear();
    const findMany = mockPrisma.aiMonitoringAlert.findMany;
    const updateMany = mockPrisma.aiMonitoringAlert.updateMany;
    try {
      Object.assign(mockPrisma.aiMonitoringAlert, {
        findMany: undefined,
        updateMany: undefined,
      });
      mockPrisma.$queryRaw.mockResolvedValue([candidate]);
      mockPrisma.$executeRaw.mockResolvedValue(1);
      expect(await getOpenClothingTransactionAlertsInStore()).toEqual([
        candidate,
      ]);
      expect(await autoResolveStaleAlertsInStore([candidate], new Date())).toBe(
        1
      );
      const [sql, ...values] = mockPrisma.$executeRaw.mock.calls[0];
      expect(sql.join('')).toContain('extract(epoch FROM "updatedAt") = ');
      expect(sql.join('')).toContain("status = 'OPEN'");
      expect(values).toContain(candidate.updatedAtToken);
      expect(await autoResolveStaleAlertsInStore([], new Date())).toBe(0);
      expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
    } finally {
      Object.assign(mockPrisma.aiMonitoringAlert, { findMany, updateMany });
    }
  });
});
