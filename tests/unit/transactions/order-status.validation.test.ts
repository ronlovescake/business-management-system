import { describe, expect, it } from 'vitest';
import {
  ORDER_STATUS_OPTIONS,
  canonicalizeOrderStatus,
} from '@/lib/transactions/order-status';
import { transactionDataSchema } from '@/modules/transactions/api/schemas';
import { buildCreateInput } from '@/modules/transactions/api/createInputHelpers';
import {
  assertClosedOrderFinancialEdit,
  assertGenericOrderStatusChange,
} from '@/modules/transactions/api/updateHelpers';
import {
  EDITABLE_ORDER_STATUS_OPTIONS,
  STATUS_FILTER_OPTIONS,
} from '@/modules/clothing/operations/transactions/types/transaction.types';

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
  const closed = {
    orderStatus: 'Cancelled',
    orderDate: '2026-03-07',
    customers: 'Sample Customer',
    productCode: 'SKU-001',
    quantity: 1,
    unitPrice: 100,
    discount: 0,
    adjustment: 40,
    lineTotal: 0,
    invoiceDate: null,
    shipmentCode: null,
  };

  it.each([
    { Quantity: 2 },
    { 'Unit Price': 101 },
    { Adjustment: 0 },
    { 'Line Total': 60 },
    { 'Order Date': '2026-03-08' },
    { Customers: 'Another Customer' },
    { 'Product Code': 'SKU-002' },
  ])('blocks generic financial rewrites of a closed order: %j', (values) => {
    expect(() => assertClosedOrderFinancialEdit(values, closed)).toThrow(
      'financial history'
    );
  });

  it.each(['Cancelled', 'Voided', 'Forfeited'])(
    'allows note edits and unchanged snapshots for historical %s',
    (orderStatus) => {
      expect(() =>
        assertClosedOrderFinancialEdit(
          {
            Notes: 'Followed up',
            Quantity: 1,
            Adjustment: 40,
            'Line Total': 0,
          },
          { ...closed, orderStatus }
        )
      ).not.toThrow();
    }
  );

  it('retains historical Forfeited recognition and filtering but removes it from new choices and imports', () => {
    expect(canonicalizeOrderStatus('Forfeited')).toBe('Forfeited');
    expect(STATUS_FILTER_OPTIONS).toContain('Forfeited');
    expect(EDITABLE_ORDER_STATUS_OPTIONS).not.toContain('Forfeited');
    expect(() => buildCreateInput(buildTransaction('Forfeited'), [])).toThrow(
      'historical only'
    );
  });

  it.each(['Cancelled', 'Voided', 'Forfeited'])(
    'prevents a generic or bulk transition directly to %s',
    (status) => {
      expect(() =>
        assertGenericOrderStatusChange(status, 'Prepared')
      ).toThrow();
    }
  );

  it('allows nonfinancial historical edits without reopening or rewriting the closed outcome', () => {
    expect(() =>
      assertGenericOrderStatusChange(undefined, 'Forfeited')
    ).not.toThrow();
    expect(() =>
      assertGenericOrderStatusChange('Forfeited', 'Forfeited')
    ).not.toThrow();
    expect(() =>
      assertGenericOrderStatusChange('Prepared', 'Forfeited')
    ).toThrow('cannot be reopened');
  });

  it('rejects a paid cancelled-order import that bypasses the decision', () => {
    expect(() =>
      buildCreateInput({ ...buildTransaction('Cancelled'), Adjustment: 10 }, [])
    ).toThrow('cancellation decision workflow');
  });

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
    expect(canonicalizeOrderStatus('accounts receivable')).toBe(
      'Accounts Receivable'
    );
    expect(canonicalizeOrderStatus(' pending payment ')).toBe(
      'Pending Payment'
    );
    expect(canonicalizeOrderStatus('on hold')).toBe('On-Hold');
    expect(canonicalizeOrderStatus('ON-HOLD')).toBe('On-Hold');
    expect(canonicalizeOrderStatus('Sorting')).toBeUndefined();
  });
});
