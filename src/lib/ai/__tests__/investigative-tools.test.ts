import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  $executeRawUnsafe: vi.fn().mockResolvedValue(0),
  $queryRawUnsafe: vi.fn().mockResolvedValue([]),
  $transaction: vi.fn(),
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
}));

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));

import {
  READ_ONLY_BUSINESS_TOOLS,
  validateAndBoundReadOnlySql,
} from '../index';

describe('Investigative business tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const model of [
      mockPrisma.customer,
      mockPrisma.transactionPayment,
      mockPrisma.transactionRefund,
      mockPrisma.expense,
      mockPrisma.clothingAccountingOpeningBalance,
      mockPrisma.clothingAccountingJournalLine,
      mockPrisma.clothingOrderCancellation,
      mockPrisma.transaction,
      mockPrisma.generalMerchandiseTransaction,
      mockPrisma.truckingInvoice,
      mockPrisma.clothingRecurringPaymentTemplate,
      mockPrisma.generalMerchandiseRecurringPaymentTemplate,
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
  });

  it('reconciles stated cash against book cash and identifies duplicate payment culprits (#3395)', async () => {
    mockPrisma.clothingAccountingOpeningBalance.findMany.mockResolvedValue([
      {
        account: 'Cash',
        ref: 'OB-1',
        description: 'Opening Cash',
        debit: 100000,
        credit: 0,
      },
    ]);
    mockPrisma.transactionPayment.findMany.mockResolvedValue([
      {
        id: 1617,
        transactionId: 3395,
        paymentDate: '2026-09-16',
        amount: 7290,
        method: 'Cash',
        isReservation: false,
        createdAt: new Date('2026-09-16T05:14:00Z'),
        transaction: {
          id: 3395,
          customers: 'Shanna Lim',
          productCode: 'CP16',
          orderDate: '2026-09-16',
          orderStatus: 'Shipped',
        },
      },
      {
        id: 1618,
        transactionId: 3395,
        paymentDate: '2026-09-16',
        amount: 7290,
        method: 'Cash',
        isReservation: false,
        createdAt: new Date('2026-09-16T05:28:00Z'),
        transaction: {
          id: 3395,
          customers: 'Shanna Lim',
          productCode: 'CP16',
          orderDate: '2026-09-16',
          orderStatus: 'Shipped',
        },
      },
    ]);
    mockPrisma.transaction.findMany.mockResolvedValue([
      {
        id: 3395,
        customers: 'Shanna Lim',
        productCode: 'CP16',
        orderDate: '2026-09-16',
        quantity: 150,
        unitPrice: 54,
        discount: 0,
        adjustment: 15390,
        lineTotal: -7290,
        orderStatus: 'Shipped',
      },
    ]);

    const tool = READ_ONLY_BUSINESS_TOOLS.find(
      (t) => t.name === 'reconcileCashAndFindDiscrepancies'
    );
    expect(tool).toBeDefined();
    if (!tool) {
      throw new Error('reconcileCashAndFindDiscrepancies missing');
    }

    const res = (await tool.execute(
      { businessUnit: 'clothing', actualCashAmount: 107290 },
      {
        userId: 'admin',
        userRole: 'SUPER_ADMIN',
        accessibleModules: [],
        allowedBusinessUnits: ['clothing'],
      }
    )) as {
      recordedBookCashEquivalents: number;
      actualCashAmount: number;
      varianceVsBookCashEquivalents: number;
      potentialCulprits: {
        duplicateOrOverpaidOrders: Array<{
          transactionId: number;
          duplicatePayments: Array<{
            firstPaymentId: number;
            secondPaymentId: number;
            amountEach: number;
          }>;
        }>;
        exactOrNearVarianceMatches: Array<{
          paymentId: number;
          amount: number;
        }>;
      };
    };

    expect(res.recordedBookCashEquivalents).toBe(114580);
    expect(res.actualCashAmount).toBe(107290);
    expect(res.varianceVsBookCashEquivalents).toBe(-7290);
    expect(res.potentialCulprits.duplicateOrOverpaidOrders).toHaveLength(1);
    expect(
      res.potentialCulprits.duplicateOrOverpaidOrders[0].transactionId
    ).toBe(3395);
    expect(
      res.potentialCulprits.duplicateOrOverpaidOrders[0].duplicatePayments
    ).toEqual([
      {
        firstPaymentId: 1617,
        secondPaymentId: 1618,
        amountEach: 7290,
        paymentDate: '2026-09-16',
        method: 'Cash',
      },
    ]);
    expect(
      res.potentialCulprits.exactOrNearVarianceMatches.length
    ).toBeGreaterThanOrEqual(2);
  });

  it('queries oldest customer from both registered directory and order history', async () => {
    mockPrisma.customer.count.mockResolvedValue(2);
    mockPrisma.customer.findMany.mockResolvedValue([
      {
        id: 1,
        customerName: 'Maria Santos',
        businessName: 'Santos Apparel',
        date: '2024-01-10',
        createdAt: new Date('2024-01-10T08:00:00Z'),
        customerStatus: 'Active',
        phoneNumber: '09171234567',
      },
    ]);
    mockPrisma.transaction.findMany.mockResolvedValue([
      {
        id: 101,
        customers: 'Maria Santos',
        customerId: 1,
        orderDate: '2024-01-12',
        createdAt: new Date('2024-01-12T09:00:00Z'),
        quantity: 10,
        unitPrice: 250,
        discount: 0,
        adjustment: 2500,
        lineTotal: 0,
        orderStatus: 'Paid',
        payments: [],
      },
      {
        id: 102,
        customers: 'Juan Dela Cruz',
        customerId: 2,
        orderDate: '2025-05-01',
        createdAt: new Date('2025-05-01T09:00:00Z'),
        quantity: 5,
        unitPrice: 300,
        discount: 0,
        adjustment: 1500,
        lineTotal: 0,
        orderStatus: 'Paid',
        payments: [],
      },
    ]);

    const tool = READ_ONLY_BUSINESS_TOOLS.find(
      (t) => t.name === 'queryCustomersAndOrderHistory'
    );
    expect(tool).toBeDefined();
    if (!tool) {
      throw new Error('queryCustomersAndOrderHistory missing');
    }

    const res = (await tool.execute(
      { businessUnit: 'clothing', sortBy: 'oldest', limit: 5 },
      {
        userId: 'admin',
        userRole: 'SUPER_ADMIN',
        accessibleModules: [],
        allowedBusinessUnits: ['clothing'],
      }
    )) as {
      registeredCustomersFromDirectory: Array<{ customerName: string }>;
      customersByOrderHistory: Array<{
        customerName: string;
        firstOrderDate: string;
      }>;
    };

    expect(res.registeredCustomersFromDirectory[0].customerName).toBe(
      'Maria Santos'
    );
    expect(res.customersByOrderHistory[0]).toMatchObject({
      customerName: 'Maria Santos',
      firstOrderDate: '2024-01-12',
    });
  });

  it('enforces read-only SQL allowlist, blocks mutating/sensitive queries, and runs inside a READ ONLY transaction', async () => {
    expect(() =>
      validateAndBoundReadOnlySql(
        'UPDATE transactions SET "lineTotal" = 0 WHERE id = 3395',
        'clothing'
      )
    ).toThrow(/only SELECT queries are permitted/i);

    expect(() =>
      validateAndBoundReadOnlySql(
        'SELECT * FROM transactions; DROP TABLE transactions',
        'clothing'
      )
    ).toThrow(/multiple statements or semicolons are not allowed/i);

    expect(() =>
      validateAndBoundReadOnlySql('SELECT * FROM users', 'clothing')
    ).toThrow(/access to sensitive user/i);

    expect(() =>
      validateAndBoundReadOnlySql('SELECT * FROM trucking_invoices', 'clothing')
    ).toThrow(/not in the allowed read-only table list/i);

    mockPrisma.$queryRawUnsafe.mockResolvedValue([
      { id: 1, customerName: 'Maria Santos' },
    ]);

    const sqlTool = READ_ONLY_BUSINESS_TOOLS.find(
      (t) => t.name === 'queryDatabaseReadOnly'
    );
    expect(sqlTool).toBeDefined();
    if (!sqlTool) {
      throw new Error('queryDatabaseReadOnly missing');
    }

    const result = await sqlTool.execute(
      {
        businessUnit: 'clothing',
        sqlQuery:
          'SELECT "id", "customerName" FROM "Customer" WHERE "deletedAt" IS NULL ORDER BY "createdAt" ASC',
        limit: 5,
      },
      {
        userId: 'admin',
        userRole: 'SUPER_ADMIN',
        accessibleModules: [],
        allowedBusinessUnits: ['clothing'],
      }
    );

    expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
      'SET LOCAL TRANSACTION READ ONLY'
    );
    expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
      'SET LOCAL statement_timeout = 3000'
    );
    expect(result).toEqual({
      businessUnit: 'clothing',
      rowCount: 1,
      rows: [{ id: 1, customerName: 'Maria Santos' }],
    });
  });
});
