import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatCustomerOrders,
  getDirectCustomerSearch,
} from '../tools/customer-order-answer';

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
  generalMerchandiseCustomer: {
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
      mockPrisma.generalMerchandiseCustomer,
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

  it.each([36, 101])(
    'returns bounded customer details with truthful completeness for %s rows',
    async (count) => {
      mockPrisma.transaction.findMany.mockResolvedValue(
        Array.from({ length: count }, (_, index) => ({
          id: index + 1,
          customerId: 624,
          customers: 'Ethan Lopez | Charlene Lopez',
          product: { product: 'Baby Socks' },
          productCode: 'BS-101725',
          orderDate: '2026-01-01',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          orderStatus: 'Shipped',
          quantity: 60,
          unitPrice: 1,
          adjustment: 60,
          lineTotal: 0,
          payments: [],
        }))
      );
      const tool = READ_ONLY_BUSINESS_TOOLS.find(
        (candidate) => candidate.name === 'queryCustomersAndOrderHistory'
      );
      if (!tool) {
        throw new Error('Customer history tool missing');
      }
      const result = (await tool.execute(
        { businessUnit: 'clothing', search: 'Charlene Lopez' },
        {
          userId: 'admin',
          userRole: 'SUPER_ADMIN',
          accessibleModules: [],
          allowedBusinessUnits: ['clothing'],
        }
      )) as {
        matchingTransactions: unknown[];
        matchingTransactionCount: number;
        returnedTransactionCount: number;
        hasMoreTransactions: boolean;
      };
      expect(result.matchingTransactionCount).toBe(count);
      expect(result.returnedTransactionCount).toBe(Math.min(100, count));
      expect(result.hasMoreTransactions).toBe(count > 100);
      expect(result.matchingTransactions).toHaveLength(Math.min(100, count));
      expect(result.matchingTransactions[0]).toMatchObject({
        customerId: 624,
        product: 'Baby Socks',
        productCode: 'BS-101725',
      });
      const markdown = formatCustomerOrders(result);
      expect(markdown).toContain(
        count === 36 ? 'all 36 records' : 'Showing 100 of 101'
      );
      expect(
        markdown?.split('\n').filter((line) => line.startsWith('| '))
      ).toHaveLength(Math.min(100, count) + 2);
      expect(markdown).not.toContain('Customer #624');
      expect(markdown).not.toContain('| Order |');
      expect(markdown).not.toMatch(/\| #\d+ \|/);
      expect(markdown).toContain('Baby Socks (BS-101725)');
      expect(markdown?.includes('every one is marked')).toBe(count === 36);
    }
  );

  it('only directly routes named count questions and rejects ambiguous or mismatched records', () => {
    expect(
      getDirectCustomerSearch('how many orders does charlene lopez has')
    ).toBe('charlene lopez');
    expect(
      getDirectCustomerSearch('How many orders does she have?')
    ).toBeNull();
    expect(getDirectCustomerSearch('who is our oldest customer?')).toBeNull();
    expect(
      formatCustomerOrders({
        customersByOrderHistory: [{ customerId: 1 }, { customerId: 2 }],
        matchingTransactions: [{}],
      })
    ).toBeNull();
    expect(
      formatCustomerOrders({
        customersByOrderHistory: [{ customerId: 1 }],
        matchingTransactions: [{ customerId: 2 }],
      })
    ).toBeNull();
  });

  it('preserves complete product codes and variant suffixes in order tables', () => {
    const markdown = formatCustomerOrders({
      customersByOrderHistory: [
        { customerId: 624, customerName: 'Lyn Domingo', totalOrders: 2 },
      ],
      matchingTransactions: [
        {
          transactionId: 3612,
          customerId: 624,
          orderDate: '2026-10-22',
          product: 'Premium Shortsleeves Onesie',
          productCode: 'PSO-101226',
          orderStatus: 'Prepared',
          quantity: 40,
        },
        {
          transactionId: 3613,
          customerId: 624,
          orderDate: '2026-10-23',
          product: 'Premium Shortsleeves Onesie',
          productCode: 'PSO-101226-XL',
          orderStatus: 'Prepared',
          quantity: 5,
        },
      ],
      matchingTransactionCount: 2,
      returnedTransactionCount: 2,
      hasMoreTransactions: false,
    });
    expect(markdown).toContain('Premium Shortsleeves Onesie (PSO-101226)');
    expect(markdown).toContain('Premium Shortsleeves Onesie (PSO-101226-XL)');
    expect(markdown).not.toContain('#3612');
  });

  it('escapes database text and shows per-row statuses when statuses differ', () => {
    const markdown = formatCustomerOrders({
      customersByOrderHistory: [
        { customerId: 624, customerName: 'Charlene', totalOrders: 2 },
      ],
      matchingTransactions: [
        {
          transactionId: 1,
          customerId: 624,
          product: '<script>bad</script>|[click](https://bad)',
          productCode: 'A',
          orderStatus: 'Shipped',
          quantity: 1,
        },
        {
          transactionId: 2,
          customerId: 624,
          productCode: 'B',
          orderStatus: 'Prepared',
          quantity: 2,
        },
      ],
      matchingTransactionCount: 2,
      returnedTransactionCount: 2,
      hasMoreTransactions: false,
    });
    expect(markdown).toContain(' Status |');
    expect(markdown).not.toContain('<script>');
    expect(markdown).toContain('&#124;');
    expect(markdown).toContain('Not recorded');
    expect(markdown).not.toContain('every one is marked');
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
