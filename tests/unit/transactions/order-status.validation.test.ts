import { describe, expect, it } from 'vitest';
import {
  ORDER_STATUS_OPTIONS,
  canonicalizeOrderStatus,
} from '@/lib/transactions/order-status';
import { transactionDataSchema } from '@/modules/transactions/api/schemas';

function buildTransaction(status: string) {
  return {
    'Order Date': '2026-03-07',
    Customers: 'Sample Customer',
    'Product Code': 'SKU-001',
    Quantity: 1,
    'Unit Price': 100,
    Discount: 0,
    Adjustment: 0,
    'Line Total': 100,
    'Order Status': status,
    Notes: null,
    'Invoice Date': null,
    'Packed Date': null,
    'Shipment Code': null,
  };
}

describe('transaction order status validation', () => {
  it('accepts every canonical order status', () => {
    ORDER_STATUS_OPTIONS.forEach((status) => {
      const result = transactionDataSchema.safeParse(buildTransaction(status));
      expect(result.success).toBe(true);
    });
  });

  it('accepts blank order status', () => {
    const result = transactionDataSchema.safeParse(buildTransaction(''));
    expect(result.success).toBe(true);
  });

  it('rejects unknown order statuses', () => {
    const result = transactionDataSchema.safeParse(buildTransaction('Sorting'));
    expect(result.success).toBe(false);
  });

  it('canonicalizes known free-form status variants', () => {
    expect(canonicalizeOrderStatus('warehouse')).toBe('Warehouse');
    expect(canonicalizeOrderStatus(' pending payment ')).toBe(
      'Pending Payment'
    );
    expect(canonicalizeOrderStatus('on hold')).toBe('On-Hold');
    expect(canonicalizeOrderStatus('ON-HOLD')).toBe('On-Hold');
    expect(canonicalizeOrderStatus('Sorting')).toBeUndefined();
  });
});
