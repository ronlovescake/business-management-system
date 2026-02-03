import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/customers/[id]/orders/route';
import { getTestApiUrl } from '@/core/testing/test-helpers';

vi.mock('@/lib/logger', async () => {
  const { mockLogger } = await import('@/core/testing/test-helpers');
  return { logger: mockLogger };
});

describe('Customer Orders API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/customers/[id]/orders', () => {
    it('returns empty orders list with ApiResponse envelope', async () => {
      const response = await GET(
        new NextRequest(getTestApiUrl('/api/customers/5/orders')),
        {
          params: { id: '5' },
        }
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
      expect(payload.message).toBe('Customer orders fetched');
      expect(Array.isArray(payload.data)).toBe(true);
      expect(payload.data.length).toBe(0);
    });

    it('returns 400 for invalid customer ID', async () => {
      const response = await GET(
        new NextRequest(getTestApiUrl('/api/customers/invalid/orders')),
        { params: { id: 'invalid' } }
      );
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe('Invalid customer ID');
    });
  });

  describe('POST /api/customers/[id]/orders', () => {
    it('creates a mock order with sanitized values', async () => {
      const orderPayload = {
        orderNumber: ' ORD-123 ',
        status: 'Delivered',
        totalAmount: '1,234.56',
        items: [
          {
            productName: ' Widget ',
            quantity: '2',
            unitPrice: '100.25',
          },
        ],
        notes: '  Rush delivery please  ',
      };

      const response = await POST(
        new NextRequest(getTestApiUrl('/api/customers/5/orders'), {
          method: 'POST',
          body: JSON.stringify(orderPayload),
        }),
        { params: { id: '5' } }
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.success).toBe(true);
      expect(payload.message).toBe('Order recorded (mock)');
      expect(payload.data.customerId).toBe(5);
      expect(payload.data.status).toBe('delivered');
      expect(payload.data.items.length).toBe(1);
      expect(payload.data.items[0].quantity).toBe(2);
      expect(payload.data.notes).toContain('Rush delivery');
    });

    it('returns 400 when customer ID is invalid', async () => {
      const response = await POST(
        new NextRequest(getTestApiUrl('/api/customers/not-a-number/orders'), {
          method: 'POST',
          body: JSON.stringify({}),
        }),
        { params: { id: 'not-a-number' } }
      );
      const payload = await response.json();

      expect(response.status).toBe(400);
      expect(payload.success).toBe(false);
      expect(payload.error).toBe('Invalid customer ID');
    });
  });
});
