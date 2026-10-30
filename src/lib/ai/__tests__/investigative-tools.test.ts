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

  it('audits different customer names using shared phone/address evidence and recorded banned status', async () => {
    const address =
      'Pk Kaugnayan Barangay GPS General Paulino Santos Koronadal City';
    mockPrisma.customer.findMany.mockResolvedValue([
      {
        id: 1,
        customerName: 'Jewel',
        customerStatus: 'Banned',
        phoneNumber: '09182123110',
        address,
        businessAddress: '',
        additionalCustomerInfo: [],
      },
      {
        id: 2,
        customerName: 'Different name',
        customerStatus: 'Active',
        phoneNumber: '+63 918 212 3110',
        address: 'Elsewhere',
        businessAddress: '',
        additionalCustomerInfo: [{ value: address }],
      },
      {
        id: 3,
        customerName: 'Unrelated',
        customerStatus: 'Active',
        phoneNumber: '',
        address: 'City Mindanao',
        businessAddress: '',
        additionalCustomerInfo: [],
      },
    ]);
    const tool = READ_ONLY_BUSINESS_TOOLS.find(
      (entry) => entry.name === 'auditPossibleCustomerDuplicates'
    );
    if (!tool) {
      throw new Error('Duplicate audit missing');
    }
    await expect(
      tool.execute(
        { businessUnit: 'clothing' },
        {
          userId: 'admin',
          userRole: 'SUPER_ADMIN',
          accessibleModules: [],
          allowedBusinessUnits: ['clothing'],
        }
      )
    ).resolves.toMatchObject({
      scannedCustomers: 3,
      matchedPairCount: 1,
      pairs: [
        {
          customers: [
            { name: 'Jewel', banned: true },
            { name: 'Different name', banned: false },
          ],
          sharedPhone: '09182123110',
          addressEvidence: expect.objectContaining({
            sharedTerms: expect.arrayContaining([
              'kaugnayan',
              'gps',
              'koronadal',
            ]),
          }),
        },
      ],
    });
  });

  it('finds Jewel as a possible address match despite inserted landmark and postal details', async () => {
    mockPrisma.customer.findMany.mockResolvedValue([
      {
        id: 74,
        customerName: 'Jewel Jamora',
        address:
          'Pk Kaugnayan, Barangay GPS(infront of ferey day care center), General Paulino Santos (Bo. 1), Koronadal City, Mindanao, South Cotabato, 9506',
        businessAddress: '',
        additionalCustomerInfo: [],
      },
      {
        id: 75,
        customerName: 'Unrelated customer',
        address: 'Koronadal City, Mindanao',
        businessAddress: '',
        additionalCustomerInfo: [],
      },
    ]);
    const tool = READ_ONLY_BUSINESS_TOOLS.find(
      (entry) => entry.name === 'findCustomersByAddress'
    );
    if (!tool) {
      throw new Error('Address tool missing');
    }
    const result = (await tool.execute(
      {
        businessUnit: 'clothing',
        address:
          'Pk Kaugnayan, Barangay GPS, General Paulino Santos (Bo. 1), Koronadal City, Mindanao',
      },
      {
        userId: 'admin',
        userRole: 'SUPER_ADMIN',
        accessibleModules: [],
        allowedBusinessUnits: ['clothing'],
      }
    )) as {
      candidates: Array<{ customerName: string; matchedTerms: string[] }>;
      warning: string;
    };
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].customerName).toBe('Jewel Jamora');
    expect(result.candidates[0].matchedTerms).toEqual(
      expect.arrayContaining(['kaugnayan', 'gps', 'koronadal'])
    );
    expect(result.warning).toContain('not confirmed identities');
    expect(mockPrisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null },
        select: expect.objectContaining({
          additionalCustomerInfo: expect.objectContaining({
            where: { type: 'address', deletedAt: null },
          }),
        }),
      })
    );
  });

  it('matches alternate addresses and reports ambiguous address candidates without confirming identity', async () => {
    const address =
      'Purok Kaugnayan, Brgy GPS, General Paulino Santos, Koronadal City';
    mockPrisma.customer.findMany.mockResolvedValue([
      {
        id: 2,
        customerName: 'Second household member',
        address,
        businessAddress: '',
        additionalCustomerInfo: [],
      },
      {
        id: 1,
        customerName: 'Jewel Jamora',
        address: 'Elsewhere',
        businessAddress: '',
        additionalCustomerInfo: [{ value: address }],
      },
    ]);
    const tool = READ_ONLY_BUSINESS_TOOLS.find(
      (entry) => entry.name === 'findCustomersByAddress'
    );
    if (!tool) {
      throw new Error('Address tool missing');
    }
    const result = (await tool.execute(
      { businessUnit: 'clothing', address },
      {
        userId: 'admin',
        userRole: 'SUPER_ADMIN',
        accessibleModules: [],
        allowedBusinessUnits: ['clothing'],
      }
    )) as {
      candidates: Array<{ customerName: string; addressSource: string }>;
      totalCandidates: number;
    };
    expect(result.totalCandidates).toBe(2);
    expect(result.candidates[0]).toMatchObject({
      customerName: 'Jewel Jamora',
      addressSource: 'additional',
    });
  });

  it('rejects unauthorized address lookup and generic locations without querying customer data', async () => {
    const tool = READ_ONLY_BUSINESS_TOOLS.find(
      (entry) => entry.name === 'findCustomersByAddress'
    );
    if (!tool) {
      throw new Error('Address tool missing');
    }
    const context = {
      userId: 'admin',
      userRole: 'SUPER_ADMIN',
      accessibleModules: [],
      allowedBusinessUnits: ['clothing' as const],
    };
    await expect(
      tool.execute(
        {
          businessUnit: 'general-merchandise',
          address: 'Pk Kaugnayan Barangay GPS Koronadal',
        },
        context
      )
    ).rejects.toThrow(/Access denied/);
    await expect(
      tool.execute(
        { businessUnit: 'clothing', address: 'City Mindanao Philippines' },
        context
      )
    ).resolves.toMatchObject({ candidates: [], needsMoreAddressDetails: true });
    expect(mockPrisma.customer.findMany).not.toHaveBeenCalled();
    expect(
      mockPrisma.generalMerchandiseCustomer.findMany
    ).not.toHaveBeenCalled();
  });

  it('keeps General Merchandise address candidates separate from Clothing', async () => {
    const address = 'Pk Kaugnayan Barangay GPS Koronadal';
    mockPrisma.generalMerchandiseCustomer.findMany.mockResolvedValue([
      {
        id: 1,
        customerName: 'GM customer',
        address,
        businessAddress: '',
        additionalCustomerInfo: [],
      },
    ]);
    const tool = READ_ONLY_BUSINESS_TOOLS.find(
      (entry) => entry.name === 'findCustomersByAddress'
    );
    if (!tool) {
      throw new Error('Address tool missing');
    }
    await expect(
      tool.execute(
        { businessUnit: 'general-merchandise', address },
        {
          userId: 'admin',
          userRole: 'SUPER_ADMIN',
          accessibleModules: [],
          allowedBusinessUnits: ['general-merchandise'],
        }
      )
    ).resolves.toMatchObject({
      businessUnit: 'general-merchandise',
      candidates: [expect.objectContaining({ customerName: 'GM customer' })],
    });
    expect(mockPrisma.customer.findMany).not.toHaveBeenCalled();
  });

  it('continues past the first customer page and discloses the bounded scan limit', async () => {
    const tool = READ_ONLY_BUSINESS_TOOLS.find(
      (entry) => entry.name === 'findCustomersByAddress'
    );
    if (!tool) {
      throw new Error('Address tool missing');
    }
    const genericRows = Array.from({ length: 500 }, (_, index) => ({
      id: index + 1,
      customerName: 'Other customer',
      address: 'City Mindanao',
      businessAddress: '',
      additionalCustomerInfo: [],
    }));
    const address = 'Pk Kaugnayan Barangay GPS Koronadal';
    const args = { businessUnit: 'clothing', address };
    const context = {
      userId: 'admin',
      userRole: 'SUPER_ADMIN',
      accessibleModules: [],
      allowedBusinessUnits: ['clothing' as const],
    };
    mockPrisma.customer.findMany
      .mockResolvedValueOnce(genericRows)
      .mockResolvedValueOnce([
        {
          id: 501,
          customerName: 'Jewel Jamora',
          address,
          businessAddress: '',
          additionalCustomerInfo: [],
        },
      ]);
    await expect(tool.execute(args, context)).resolves.toMatchObject({
      scannedCustomers: 501,
      scanLimitReached: false,
      candidates: [expect.objectContaining({ customerName: 'Jewel Jamora' })],
    });
    expect(mockPrisma.customer.findMany.mock.calls[1][0]).toMatchObject({
      cursor: { id: 500 },
      skip: 1,
    });
    mockPrisma.customer.findMany.mockClear();
    mockPrisma.customer.findMany.mockResolvedValue(genericRows);
    await expect(tool.execute(args, context)).resolves.toMatchObject({
      scannedCustomers: 5000,
      scanLimitReached: true,
    });
    expect(mockPrisma.customer.findMany).toHaveBeenCalledTimes(10);
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
