import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { getTestApiUrl } from '@/core/testing/test-helpers';

const {
  mockTransactionService,
  MockReferenceError,
  MockValidationError,
  MockNotFoundError,
} = vi.hoisted(() => ({
  mockTransactionService: {
    findActive: vi.fn(),
    importTransactions: vi.fn(),
    bulkUpdateTransactions: vi.fn(),
    updateTransaction: vi.fn(),
    softDeleteAll: vi.fn(),
  },
  MockReferenceError: class extends Error {
    constructor(
      message: string,
      public details: Record<string, unknown>
    ) {
      super(message);
    }
  },
  MockValidationError: class extends Error {},
  MockNotFoundError: class extends Error {},
}));

const mockPrisma = vi.hoisted(() => {
  const tx = {
    generalMerchandiseTransactionPayment: {
      createMany: vi.fn(),
      groupBy: vi.fn(),
    },
    generalMerchandiseTransaction: {
      update: vi.fn(),
    },
  };

  return {
    generalMerchandiseTransaction: {
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
    __tx: tx,
  };
});

vi.mock('@/modules/general-merchandise/transactions/api/service', () => ({
  generalMerchandiseTransactionService: mockTransactionService,
}));

vi.mock('@/modules/transactions/api/service', () => ({
  TransactionReferenceError: MockReferenceError,
  TransactionValidationError: MockValidationError,
  TransactionNotFoundError: MockNotFoundError,
}));

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/logger', async () => {
  const { mockLogger } = await import('@/core/testing/test-helpers');
  return { logger: mockLogger };
});

vi.mock('@/lib/validations/transaction-payment.validation', () => ({
  transactionPaymentBulkCreateSchema: {
    safeParse: vi.fn((body) => ({ success: true, data: body })),
  },
  formatValidationErrors: vi.fn(() => ({ payments: 'invalid' })),
}));

import {
  GET,
  POST,
  DELETE,
} from '@/app/api/general-merchandise/transactions/route';
import { POST as BULK_PAYMENTS_POST } from '@/app/api/general-merchandise/transactions/payments/bulk/route';
import { TransactionReferenceError } from '@/modules/transactions/api/service';

describe('General merchandise transactions API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (callback) =>
      callback(mockPrisma.__tx)
    );
  });

  it('returns GM transactions from the shared route factory GET handler', async () => {
    mockTransactionService.findActive.mockResolvedValue([
      { id: 1, 'Product Code': 'GM-001' },
    ]);

    const response = await GET(
      new NextRequest(getTestApiUrl('/api/general-merchandise/transactions'))
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data[0]['Product Code']).toBe('GM-001');
  });

  it('maps GM transaction reference violations to conflict responses', async () => {
    mockTransactionService.importTransactions.mockRejectedValue(
      new TransactionReferenceError('Reference integrity violation', {
        missing: { customers: ['ACME'], products: [], shipments: [] },
        counts: { customers: 1, products: 0, shipments: 0 },
        suggestion: 'Verify GM reference data before importing.',
      })
    );

    const response = await POST(
      new NextRequest(getTestApiUrl('/api/general-merchandise/transactions'), {
        method: 'POST',
        body: JSON.stringify([{}]),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Reference integrity violation');
  });

  it('soft deletes GM transactions only when the confirmation token is present', async () => {
    mockTransactionService.softDeleteAll.mockResolvedValue({
      deleted: 3,
      alreadyDeleted: 1,
    });

    const response = await DELETE(
      new NextRequest(
        getTestApiUrl('/api/general-merchandise/transactions', {
          confirm: 'DELETE_ALL_TRANSACTIONS',
        }),
        { method: 'DELETE' }
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.deleted).toBe(3);
    expect(mockTransactionService.softDeleteAll).toHaveBeenCalled();
  });

  it('rejects bulk GM transaction payments when some transaction ids are missing', async () => {
    mockPrisma.generalMerchandiseTransaction.findMany.mockResolvedValue([
      { id: 1, quantity: 2, unitPrice: 100 },
    ]);

    const response = await BULK_PAYMENTS_POST(
      new NextRequest(
        getTestApiUrl('/api/general-merchandise/transactions/payments/bulk'),
        {
          method: 'POST',
          body: JSON.stringify({
            payments: [
              {
                transactionId: 1,
                paymentDate: '2026-03-17',
                amount: 50,
              },
              {
                transactionId: 2,
                paymentDate: '2026-03-17',
                amount: 60,
              },
            ],
          }),
        }
      )
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Invalid transaction IDs');
  });

  it('creates bulk GM transaction payments and recomputes adjustments', async () => {
    mockPrisma.generalMerchandiseTransaction.findMany.mockResolvedValue([
      { id: 1, quantity: 2, unitPrice: 100 },
      { id: 2, quantity: 1, unitPrice: 80 },
    ]);
    mockPrisma.$queryRaw.mockResolvedValue([{ exists: 1 }]);
    mockPrisma.__tx.generalMerchandiseTransactionPayment.createMany.mockResolvedValue(
      { count: 2 }
    );
    mockPrisma.__tx.generalMerchandiseTransactionPayment.groupBy.mockResolvedValue(
      [
        { transactionId: 1, _sum: { amount: 50 } },
        { transactionId: 2, _sum: { amount: 20 } },
      ]
    );
    mockPrisma.__tx.generalMerchandiseTransaction.update
      .mockResolvedValueOnce({ id: 1, adjustment: 50, lineTotal: 150 })
      .mockResolvedValueOnce({ id: 2, adjustment: 20, lineTotal: 60 });

    const response = await BULK_PAYMENTS_POST(
      new NextRequest(
        getTestApiUrl('/api/general-merchandise/transactions/payments/bulk'),
        {
          method: 'POST',
          body: JSON.stringify({
            payments: [
              {
                transactionId: 1,
                paymentDate: '2026-03-17',
                amount: 50,
                method: 'Cash',
                isReservation: true,
              },
              {
                transactionId: 2,
                paymentDate: '2026-03-17',
                amount: 20,
                notes: 'Partial',
              },
            ],
          }),
        }
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toBe('Payments recorded');
    expect(body.data.paymentsCreated).toBe(2);
    expect(
      mockPrisma.__tx.generalMerchandiseTransactionPayment.createMany
    ).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          transactionId: 1,
          amount: 50,
          isReservation: true,
        }),
        expect.objectContaining({
          transactionId: 2,
          amount: 20,
          isReservation: false,
        }),
      ],
    });
    expect(
      mockPrisma.__tx.generalMerchandiseTransaction.update
    ).toHaveBeenNthCalledWith(1, {
      where: { id: 1 },
      data: { adjustment: 50, lineTotal: 150 },
      select: { id: true, adjustment: true, lineTotal: true },
    });
    expect(
      mockPrisma.__tx.generalMerchandiseTransaction.update
    ).toHaveBeenNthCalledWith(2, {
      where: { id: 2 },
      data: { adjustment: 20, lineTotal: 60 },
      select: { id: true, adjustment: true, lineTotal: true },
    });
  });
});
