import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  $executeRawUnsafe: vi.fn().mockResolvedValue(0),
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
  assertBusinessUnitAccess,
  estimateModelCostUsd,
  resolveAllowedBusinessUnits,
  runBusinessAiAssistant,
  runDeterministicBusinessMonitor,
  updateAiAssistantSettings,
} from '../index';

describe('AI Business Assistant — Safety, RBAC & Deterministic Monitoring', () => {
  beforeEach(() => {
    vi.clearAllMocks();

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

  it('enforces readOnly=true on all registered business tools', () => {
    expect(READ_ONLY_BUSINESS_TOOLS.length).toBeGreaterThanOrEqual(4);
    for (const tool of READ_ONLY_BUSINESS_TOOLS) {
      expect(tool.readOnly).toBe(true);
      expect(tool.businessUnits.length).toBeGreaterThan(0);
    }
  });

  it('scopes allowed business units strictly by user role and module paths', () => {
    expect(
      resolveAllowedBusinessUnits('USER', [
        '/clothing/operations/transactions',
        '/clothing/operations/customers',
      ])
    ).toEqual(['clothing']);

    expect(
      resolveAllowedBusinessUnits('USER', ['/trucking/operations/trips'])
    ).toEqual(['trucking']);

    expect(resolveAllowedBusinessUnits('ADMIN', [])).toEqual([
      'clothing',
      'trucking',
      'general-merchandise',
    ]);
  });

  it('blocks cross-business tool access when user lacks permission for target business unit', async () => {
    const clothingOnlyContext = {
      userId: 'user-1',
      userRole: 'USER',
      accessibleModules: ['/clothing/operations/transactions'],
      allowedBusinessUnits: ['clothing' as const],
    };

    expect(() =>
      assertBusinessUnitAccess(clothingOnlyContext, 'trucking')
    ).toThrow(/Access denied/i);

    const overdueTool = READ_ONLY_BUSINESS_TOOLS.find(
      (t) => t.name === 'getOverdueInvoicesAndReceivables'
    );
    expect(overdueTool).toBeDefined();
    if (!overdueTool) {
      throw new Error('Tool missing');
    }

    await expect(
      overdueTool.execute({ businessUnit: 'trucking' }, clothingOnlyContext)
    ).rejects.toThrow(/Access denied/i);
  });

  it('blocks cloud providers when allowCloudDataSharing is false', async () => {
    const context = {
      userId: 'admin-1',
      userRole: 'SUPER_ADMIN',
      accessibleModules: [],
      allowedBusinessUnits: ['clothing' as const],
    };

    await expect(
      runBusinessAiAssistant({
        userPrompt: 'Show overdue clothing invoices',
        triggerSource: 'USER_CHAT',
        toolContext: context,
        providerOverride: 'google',
        modelOverride: 'gemini-2.5-flash',
      })
    ).rejects.toThrow(/Cloud Data Sharing is disabled/i);
  });

  it('prevents configuring a cloud fallback provider while Cloud Data Sharing is disabled', async () => {
    await expect(
      updateAiAssistantSettings(
        {
          activeProvider: 'ollama',
          activeModel: 'qwen3:8b',
          accountingModel: null,
          ollamaBaseUrl: 'http://host.docker.internal:11434',
          fallbackProvider: 'openai',
          fallbackModel: 'gpt-4o-mini',
          allowCloudDataSharing: false,
          dailyTokenLimit: 250000,
          monthlyBudgetUsd: 15,
          monitoringEnabled: true,
          morningBriefingEnabled: true,
          morningBriefingTime: '07:00',
          timezone: 'Asia/Manila',
        },
        'admin-1'
      )
    ).rejects.toThrow(/Cannot configure a cloud fallback provider/i);
  });

  it('computes zero token cost for local Ollama and positive cost for cloud models', () => {
    expect(estimateModelCostUsd('ollama', 'qwen3:8b', 50000, 10000)).toBe(0);
    expect(
      estimateModelCostUsd('google', 'gemini-2.5-flash', 1_000_000, 1_000_000)
    ).toBeCloseTo(0.75, 4);
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
    mockPrisma.aiMonitoringAlert.findMany.mockResolvedValue([
      { id: 'stale-alert-1' },
    ]);
    mockPrisma.aiMonitoringAlert.updateMany.mockResolvedValue({ count: 1 });

    const summary = await runDeterministicBusinessMonitor();

    expect(summary.detectedCount).toBe(2);
    expect(summary.byBusinessUnit.clothing).toBe(1);
    expect(summary.byBusinessUnit.trucking).toBe(1);
    expect(summary.autoResolvedCount).toBe(1);
    expect(mockPrisma.aiMonitoringAlert.upsert).toHaveBeenCalledTimes(2);
  });
});
