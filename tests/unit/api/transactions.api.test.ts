import { describe, it, expect, beforeEach, vi } from 'vitest';
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
    constructor(public details: unknown) {
      super('Reference integrity violation');
    }
  },
  MockValidationError: class extends Error {},
  MockNotFoundError: class extends Error {},
}));

vi.mock('@/modules/transactions/api/service', () => ({
  transactionService: mockTransactionService,
  TransactionReferenceError: MockReferenceError,
  TransactionValidationError: MockValidationError,
  TransactionNotFoundError: MockNotFoundError,
}));

import {
  TransactionReferenceError,
  TransactionNotFoundError,
} from '@/modules/transactions/api/service';
import { GET, POST, PUT, PATCH, DELETE } from '@/app/api/transactions/route';

describe('Transactions API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/transactions', () => {
    it('returns transactions successfully', async () => {
      mockTransactionService.findActive.mockResolvedValue([
        {
          id: 1,
          'Order Date': '2024-01-01',
          Customers: 'John Doe',
          'Product Code': 'PRD-1',
          Quantity: 1,
          'Unit Price': 10,
          Discount: 0,
          Adjustment: 0,
          'Line Total': 10,
          'Order Status': 'Prepared',
          Notes: null,
          'Invoice Date': null,
          'Packed Date': null,
          'Shipment Code': null,
        },
      ]);

      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data[0]['Product Code']).toBe('PRD-1');
    });

    it('handles service errors', async () => {
      mockTransactionService.findActive.mockRejectedValue(new Error('boom'));

      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Failed to fetch transactions');
    });
  });

  describe('POST /api/transactions', () => {
    it('validates payload as array', async () => {
      const request = new NextRequest(getTestApiUrl('/api/transactions'), {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Invalid data format');
    });

    it('imports transactions successfully', async () => {
      mockTransactionService.importTransactions.mockResolvedValue({
        count: 2,
        withData: 2,
        empty: 0,
      });

      const request = new NextRequest(getTestApiUrl('/api/transactions'), {
        method: 'POST',
        body: JSON.stringify([{}]),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(201);
      expect(body.data.count).toBe(2);
      expect(mockTransactionService.importTransactions).toHaveBeenCalled();
    });

    it('returns conflict when references are missing', async () => {
      mockTransactionService.importTransactions.mockRejectedValue(
        new TransactionReferenceError({
          missing: { customers: [], products: [], shipments: [] },
        })
      );

      const request = new NextRequest(getTestApiUrl('/api/transactions'), {
        method: 'POST',
        body: JSON.stringify([{}]),
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.success).toBe(false);
      expect(body.error).toBe('Reference integrity violation');
    });
  });

  describe('PUT /api/transactions', () => {
    it('requires array payload', async () => {
      const request = new NextRequest(getTestApiUrl('/api/transactions'), {
        method: 'PUT',
        body: JSON.stringify({}),
      });

      const response = await PUT(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Invalid data format');
    });

    it('updates transactions successfully', async () => {
      mockTransactionService.bulkUpdateTransactions.mockResolvedValue({
        count: 3,
      });

      const request = new NextRequest(getTestApiUrl('/api/transactions'), {
        method: 'PUT',
        body: JSON.stringify([{}]),
      });

      const response = await PUT(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.count).toBe(3);
    });

    it('returns not found when service throws TransactionNotFoundError', async () => {
      mockTransactionService.bulkUpdateTransactions.mockRejectedValue(
        new TransactionNotFoundError('Transaction not found')
      );

      const request = new NextRequest(getTestApiUrl('/api/transactions'), {
        method: 'PUT',
        body: JSON.stringify([{}]),
      });

      const response = await PUT(request);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toBe('Transaction not found');
    });
  });

  describe('PATCH /api/transactions', () => {
    it('updates single transaction successfully', async () => {
      mockTransactionService.updateTransaction.mockResolvedValue({
        transaction: {
          id: 1,
          'Order Date': '2024-01-01',
          Customers: 'John Doe',
          'Product Code': 'PRD-1',
          Quantity: 1,
          'Unit Price': 10,
          Discount: 0,
          Adjustment: 0,
          'Line Total': 10,
          'Order Status': 'Prepared',
          Notes: null,
          'Invoice Date': null,
          'Packed Date': null,
          'Shipment Code': null,
        },
      });

      const request = new NextRequest(getTestApiUrl('/api/transactions'), {
        method: 'PATCH',
        body: JSON.stringify({ id: 1 }),
      });

      const response = await PATCH(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.id).toBe(1);
    });

    it('returns 404 when transaction is missing', async () => {
      mockTransactionService.updateTransaction.mockRejectedValue(
        new TransactionNotFoundError('Transaction not found')
      );

      const request = new NextRequest(getTestApiUrl('/api/transactions'), {
        method: 'PATCH',
        body: JSON.stringify({ id: 99 }),
      });

      const response = await PATCH(request);
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toBe('Transaction not found');
    });
  });

  describe('DELETE /api/transactions', () => {
    it('protects against accidental deletion', async () => {
      const request = new NextRequest(getTestApiUrl('/api/transactions'), {
        method: 'DELETE',
      });

      const response = await DELETE(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Mass deletion protection');
    });

    it('soft deletes transactions when confirmed', async () => {
      mockTransactionService.softDeleteAll.mockResolvedValue({
        deleted: 5,
        alreadyDeleted: 1,
      });

      const request = new NextRequest(
        getTestApiUrl('/api/transactions', {
          confirm: 'DELETE_ALL_TRANSACTIONS',
        }),
        { method: 'DELETE' }
      );

      const response = await DELETE(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.data.deleted).toBe(5);
      expect(mockTransactionService.softDeleteAll).toHaveBeenCalled();
    });
  });
});
