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
  assertBusinessUnitAccess,
  estimateModelCostUsd,
  resolveAllowedBusinessUnits,
  runBusinessAiAssistant,
  updateAiAssistantSettings,
} from '../index';

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

  it('answers an explicit Clothing policy question locally without contacting a model', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Model must not be called'));
    try {
      const result = await runBusinessAiAssistant({
        userPrompt: 'How do due dates work?',
        businessUnit: 'clothing',
        triggerSource: 'USER_CHAT',
        toolContext: {
          userId: 'admin',
          userRole: 'SUPER_ADMIN',
          accessibleModules: [],
          allowedBusinessUnits: ['clothing'],
        },
      });
      expect(result.model).toBe('deterministic-knowledge');
      expect(result.text).toContain('11:59 PM');
      expect(result.inputTokens + result.outputTokens).toBe(0);
      expect(result.usedFallback).toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('returns all 36 customer order records without a provider request', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue(
      Array.from({ length: 36 }, (_, index) => ({
        id: index + 1,
        customerId: 624,
        customers: 'Ethan Lopez | Charlene Lopez',
        product: { product: 'Baby Socks' },
        productCode: 'BS-101725',
        quantity: 60,
        orderDate: '2026-01-01',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        orderStatus: 'Shipped',
        unitPrice: 1,
        adjustment: 60,
        lineTotal: 0,
        payments: [],
      }))
    );
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Model must not be called'));
    try {
      const result = await runBusinessAiAssistant({
        userPrompt: 'how many orders does charlene lopez has',
        triggerSource: 'USER_CHAT',
        toolContext: {
          userId: 'admin',
          userRole: 'SUPER_ADMIN',
          accessibleModules: [],
          allowedBusinessUnits: ['clothing'],
        },
      });
      expect(result.model).toBe('deterministic-customer-orders');
      expect(result.text).toContain('all 36 records');
      expect(
        result.text.split('\n').filter((line) => line.startsWith('| '))
      ).toHaveLength(38);
      expect(result.text).not.toContain('Customer #624');
      expect(result.text).not.toContain('| Order |');
      expect(result.text).toContain('Baby Socks (BS-101725)');
      expect(result.outputTokens).toBe(0);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('does not bypass Copilot authorization through the local policy path', async () => {
    const settings = await mockPrisma.aiAssistantSetting.upsert();
    mockPrisma.aiAssistantSetting.upsert.mockResolvedValue({
      ...settings,
      activeProvider: 'copilot',
      allowCloudDataSharing: true,
    });
    vi.stubEnv('COPILOT_ALLOWED_USER_ID', 'different-owner');
    try {
      await expect(
        runBusinessAiAssistant({
          userPrompt: 'How do due dates work?',
          businessUnit: 'clothing',
          triggerSource: 'USER_CHAT',
          toolContext: {
            userId: 'admin',
            userRole: 'SUPER_ADMIN',
            accessibleModules: [],
            allowedBusinessUnits: ['clothing'],
          },
        })
      ).rejects.toThrow(/COPILOT_ALLOWED_USER_ID/);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('retains a safe failure reason and full provider-wait latency when local fallback succeeds', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000);
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => {
        clock.mockReturnValue(46000);
        throw Object.assign(
          new Error(
            'Provider request timed out: secret-token-should-not-be-saved'
          ),
          {
            providerDiagnostics: {
              phase: 'model-response',
              elapsedMs: 45000,
              toolCallsStarted: 2,
              toolCallsCompleted: 2,
              activeToolNames: [],
              prompt: 'private-prompt-should-not-be-saved',
            },
          }
        );
      });
    try {
      const result = await runBusinessAiAssistant({
        userPrompt: 'Show upcoming dues',
        businessUnit: 'clothing',
        triggerSource: 'USER_CHAT',
        toolContext: {
          userId: 'admin',
          userRole: 'SUPER_ADMIN',
          accessibleModules: [],
          allowedBusinessUnits: ['clothing'],
        },
      });
      expect(result.usedFallback).toBe(true);
      expect(result.latencyMs).toBe(45000);
      expect(result.fallbackReason).toBe('ollama: Provider request timed out.');
      expect(
        JSON.stringify(mockPrisma.aiAuditLog.create.mock.calls)
      ).not.toContain('secret-token-should-not-be-saved');
      expect(
        JSON.stringify(mockPrisma.aiAuditLog.create.mock.calls)
      ).not.toContain('private-prompt-should-not-be-saved');
      expect(mockPrisma.aiAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              providerFailures: [
                expect.objectContaining({
                  diagnostics: {
                    phase: 'model-response',
                    elapsedMs: 45000,
                    toolCallsStarted: 2,
                    toolCallsCompleted: 2,
                    activeToolNames: [],
                  },
                }),
              ],
            }),
          }),
        })
      );
      expect(mockPrisma.aiAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            latencyMs: 45000,
            metadata: expect.objectContaining({
              fallbackReason: result.fallbackReason,
            }),
          }),
        })
      );
    } finally {
      fetchSpy.mockRestore();
      clock.mockRestore();
    }
  });

  it('audits a sanitized provider error when no fallback evidence is available', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Quota exhausted: private-value'));
    try {
      await expect(
        runBusinessAiAssistant({
          userPrompt: 'Hello',
          triggerSource: 'USER_CHAT',
          enableTools: false,
          toolContext: {
            userId: 'admin',
            userRole: 'SUPER_ADMIN',
            accessibleModules: [],
            allowedBusinessUnits: ['clothing'],
          },
        })
      ).rejects.toThrow('Quota exhausted');
      expect(mockPrisma.aiAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'ERROR',
            errorMessage: 'Provider quota or capacity limit reached.',
            metadata: expect.objectContaining({
              providerFailures: [
                expect.objectContaining({
                  reason: 'Provider quota or capacity limit reached.',
                }),
              ],
            }),
          }),
        })
      );
      expect(
        JSON.stringify(mockPrisma.aiAuditLog.create.mock.calls)
      ).not.toContain('private-value');
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('answers duplicate audits directly without cloud calls or unrelated dues', async () => {
    mockPrisma.customer.findMany.mockResolvedValue([
      {
        id: 1,
        customerName: 'First',
        customerStatus: 'Banned',
        phoneNumber: '09182123110',
        address: '',
        businessAddress: '',
        additionalCustomerInfo: [],
      },
      {
        id: 2,
        customerName: 'Second',
        customerStatus: 'Active',
        phoneNumber: '+639182123110',
        address: '',
        businessAddress: '',
        additionalCustomerInfo: [],
      },
    ]);
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Cloud must not run'));
    try {
      const result = await runBusinessAiAssistant({
        userPrompt:
          'Can you check customers for possible duplicates? Banned customers use different names but the same phone and address.',
        businessUnit: 'clothing',
        triggerSource: 'USER_CHAT',
        toolContext: {
          userId: 'admin',
          userRole: 'SUPER_ADMIN',
          accessibleModules: [],
          allowedBusinessUnits: ['clothing'],
        },
      });
      expect(result.model).toBe('deterministic-customer-duplicate-audit');
      expect(result.text).toContain('1 possible pairs');
      expect(result.text).toContain('Banned');
      expect(result.text).not.toContain('Recurring');
      expect(result.inputTokens + result.outputTokens).toBe(0);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('does not replace a failed duplicate audit with dues or a provider retry', async () => {
    mockPrisma.customer.findMany.mockRejectedValue(
      new Error('Database unavailable')
    );
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Cloud must not run'));
    try {
      await expect(
        runBusinessAiAssistant({
          userPrompt: 'Find duplicate customers',
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
        'Could not complete the Clothing customer duplicate audit'
      );
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(
        mockPrisma.clothingRecurringPaymentTemplate.findMany
      ).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
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

  it.each(['google', 'copilot'] as const)(
    'blocks %s when allowCloudDataSharing is false',
    async (provider) => {
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
          providerOverride: provider,
          modelOverride: 'gemini-2.5-flash',
        })
      ).rejects.toThrow(/Cloud Data Sharing is disabled/i);
    }
  );

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
});
