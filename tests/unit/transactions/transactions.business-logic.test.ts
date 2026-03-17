import { describe, it, expect } from 'vitest';
import {
  normalizeTransactionAmounts,
  normalizeTransactionAmountsForAccounting,
} from '@/lib/accounting/transaction-normalization';
import {
  hasMinimumCreateFields,
  computeRemainingBalance,
} from '@/modules/clothing/operations/transactions/hooks/transactionDraftUtils';
import {
  truncateText,
  isPaidOrderStatus,
  describeTransaction,
} from '@/modules/clothing/operations/transactions/hooks/transactionOperationUtils';
import {
  getCellValue,
  getNumericValue,
} from '@/modules/clothing/operations/transactions/hooks/transactionCellValueUtils';

// ──────────────────────────────────────────────────────────
// normalizeTransactionAmounts
// ──────────────────────────────────────────────────────────

describe('normalizeTransactionAmounts', () => {
  it('calculates grossSale from quantity × unitPrice', () => {
    const result = normalizeTransactionAmounts({
      quantity: 5,
      unitPrice: 100,
    });
    expect(result.grossSale).toBe(500);
  });

  it('uses adjustment as paymentReceived', () => {
    const result = normalizeTransactionAmounts({
      quantity: 2,
      unitPrice: 100,
      adjustment: 150,
    });
    expect(result.paymentReceived).toBe(150);
  });

  it('derives balance from grossSale minus paymentReceived', () => {
    const result = normalizeTransactionAmounts({
      quantity: 2,
      unitPrice: 100,
      adjustment: 50,
    });
    expect(result.balanceDue).toBe(150);
  });

  it('uses lineTotal as explicit balanceDue when provided', () => {
    const result = normalizeTransactionAmounts({
      quantity: 2,
      unitPrice: 100,
      lineTotal: 75,
    });
    expect(result.balanceDue).toBe(75);
  });

  it('returns zero grossSale for null quantity and unitPrice', () => {
    const result = normalizeTransactionAmounts({});
    expect(result.grossSale).toBe(0);
    expect(result.paymentReceived).toBe(0);
    expect(result.balanceDue).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────
// normalizeTransactionAmountsForAccounting
// ──────────────────────────────────────────────────────────

describe('normalizeTransactionAmountsForAccounting', () => {
  it('treats Checked Out as fully paid', () => {
    const result = normalizeTransactionAmountsForAccounting({
      quantity: 3,
      unitPrice: 100,
      orderStatus: 'Checked Out',
    });
    expect(result.paymentReceived).toBe(300);
    expect(result.balanceDue).toBe(0);
  });

  it('treats Shipped as fully paid', () => {
    const result = normalizeTransactionAmountsForAccounting({
      quantity: 2,
      unitPrice: 50,
      orderStatus: 'Shipped',
    });
    expect(result.paymentReceived).toBe(100);
    expect(result.balanceDue).toBe(0);
  });

  it('treats Ready For Dispatch as fully paid', () => {
    const result = normalizeTransactionAmountsForAccounting({
      quantity: 1,
      unitPrice: 200,
      orderStatus: 'Ready For Dispatch',
    });
    expect(result.paymentReceived).toBe(200);
    expect(result.balanceDue).toBe(0);
  });

  it('treats Pending Payment with adjustment as partial payment', () => {
    const result = normalizeTransactionAmountsForAccounting({
      quantity: 2,
      unitPrice: 100,
      adjustment: 50,
      orderStatus: 'Pending Payment',
    });
    expect(result.grossSale).toBe(200);
    expect(result.paymentReceived).toBe(50);
    expect(result.balanceDue).toBe(150);
  });

  it('falls through to default for other statuses', () => {
    const result = normalizeTransactionAmountsForAccounting({
      quantity: 2,
      unitPrice: 100,
      orderStatus: 'Warehouse',
    });
    expect(result.grossSale).toBe(200);
  });
});

// ──────────────────────────────────────────────────────────
// hasMinimumCreateFields
// ──────────────────────────────────────────────────────────

describe('hasMinimumCreateFields', () => {
  const base = {
    'Order Date': '2026-01-01',
    Customers: 'Alice',
    'Product Code': 'P001',
    Quantity: 1,
    'Unit Price': 100,
    Discount: 0,
    Adjustment: 0,
    'Line Total': 100,
    'Order Status': '',
    Notes: '',
    'Invoice Date': '',
    'Packed Date': '',
    'Shipment Code': '',
  };

  it('returns true when order date and customer are present', () => {
    expect(hasMinimumCreateFields(base)).toBe(true);
  });

  it('returns true when order date and product are present (no customer)', () => {
    expect(hasMinimumCreateFields({ ...base, Customers: '' })).toBe(true);
  });

  it('returns false when order date is missing', () => {
    expect(hasMinimumCreateFields({ ...base, 'Order Date': '' })).toBe(false);
  });

  it('returns false when both customer and product are missing', () => {
    expect(
      hasMinimumCreateFields({ ...base, Customers: '', 'Product Code': '' })
    ).toBe(false);
  });

  it('trims whitespace before checking', () => {
    expect(hasMinimumCreateFields({ ...base, 'Order Date': '   ' })).toBe(
      false
    );
  });
});

// ──────────────────────────────────────────────────────────
// computeRemainingBalance
// ──────────────────────────────────────────────────────────

describe('computeRemainingBalance', () => {
  it('uses lineTotal directly when it is a finite number', () => {
    const row = {
      'Order Date': '',
      Customers: '',
      'Product Code': '',
      Quantity: 5,
      'Unit Price': 100,
      Discount: 0,
      Adjustment: 0,
      'Line Total': 200,
      'Order Status': '',
      Notes: '',
      'Invoice Date': '',
      'Packed Date': '',
      'Shipment Code': '',
    };
    expect(computeRemainingBalance(row)).toBe(200);
  });

  it('computes balance from qty/price/discount/adjustment when lineTotal is missing', () => {
    const row = {
      'Order Date': '',
      Customers: '',
      'Product Code': '',
      Quantity: 3,
      'Unit Price': 200,
      Discount: 50,
      Adjustment: 100,
      'Line Total': NaN,
      'Order Status': '',
      Notes: '',
      'Invoice Date': '',
      'Packed Date': '',
      'Shipment Code': '',
    };
    // 3 * 200 - 50 - 100 = 450
    expect(computeRemainingBalance(row)).toBe(450);
  });
});

// ──────────────────────────────────────────────────────────
// truncateText
// ──────────────────────────────────────────────────────────

describe('truncateText', () => {
  it('returns text unchanged when within max length', () => {
    expect(truncateText('hello', 10)).toBe('hello');
  });

  it('truncates text exceeding max and appends ellipsis', () => {
    const result = truncateText('abcdefghij', 5);
    expect(result).toBe('abcd…');
    expect(result.length).toBe(5);
  });

  it('uses default max of 160', () => {
    const longText = 'a'.repeat(200);
    const result = truncateText(longText);
    expect(result.length).toBe(160);
    expect(result.endsWith('…')).toBe(true);
  });

  it('returns text unchanged when exactly at max', () => {
    const text = 'a'.repeat(10);
    expect(truncateText(text, 10)).toBe(text);
  });
});

// ──────────────────────────────────────────────────────────
// isPaidOrderStatus
// ──────────────────────────────────────────────────────────

describe('isPaidOrderStatus', () => {
  it('returns true for "Checked Out"', () => {
    expect(isPaidOrderStatus('Checked Out')).toBe(true);
  });

  it('returns true for "Shipped"', () => {
    expect(isPaidOrderStatus('Shipped')).toBe(true);
  });

  it('returns true for "Ready For Dispatch"', () => {
    expect(isPaidOrderStatus('Ready For Dispatch')).toBe(true);
  });

  it('returns false for "Pending Payment"', () => {
    expect(isPaidOrderStatus('Pending Payment')).toBe(false);
  });

  it('returns false for "Warehouse"', () => {
    expect(isPaidOrderStatus('Warehouse')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isPaidOrderStatus(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isPaidOrderStatus(undefined)).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isPaidOrderStatus('checked out')).toBe(true);
    expect(isPaidOrderStatus('SHIPPED')).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────
// describeTransaction
// ──────────────────────────────────────────────────────────

describe('describeTransaction', () => {
  it('includes the transaction id', () => {
    const tx = {
      id: 42,
      'Order Date': '',
      Customers: 'Alice',
      'Product Code': 'PROD-01',
      Quantity: 1,
      'Unit Price': 100,
      Discount: 0,
      Adjustment: 0,
      'Line Total': 100,
      'Order Status': '',
      Notes: '',
      'Invoice Date': '',
      'Packed Date': '',
      'Shipment Code': '',
    };
    expect(describeTransaction(tx)).toContain('#42');
  });

  it('uses "unsaved row" when id is missing', () => {
    const tx = {
      'Order Date': '',
      Customers: 'Alice',
      'Product Code': 'PROD-01',
      Quantity: 1,
      'Unit Price': 100,
      Discount: 0,
      Adjustment: 0,
      'Line Total': 100,
      'Order Status': '',
      Notes: '',
      'Invoice Date': '',
      'Packed Date': '',
      'Shipment Code': '',
    };
    expect(describeTransaction(tx)).toContain('unsaved row');
  });

  it('shows customer name', () => {
    const tx = {
      id: 1,
      'Order Date': '',
      Customers: 'Bob',
      'Product Code': '',
      Quantity: 1,
      'Unit Price': 100,
      Discount: 0,
      Adjustment: 0,
      'Line Total': 100,
      'Order Status': '',
      Notes: '',
      'Invoice Date': '',
      'Packed Date': '',
      'Shipment Code': '',
    };
    expect(describeTransaction(tx)).toContain('Bob');
  });

  it('shows "No customer" when customer is empty', () => {
    const tx = {
      id: 1,
      'Order Date': '',
      Customers: '',
      'Product Code': 'PROD-01',
      Quantity: 1,
      'Unit Price': 100,
      Discount: 0,
      Adjustment: 0,
      'Line Total': 100,
      'Order Status': '',
      Notes: '',
      'Invoice Date': '',
      'Packed Date': '',
      'Shipment Code': '',
    };
    expect(describeTransaction(tx)).toContain('No customer');
  });
});

// ──────────────────────────────────────────────────────────
// getCellValue
// ──────────────────────────────────────────────────────────

describe('getCellValue', () => {
  it('returns empty string for null', () => {
    expect(getCellValue(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(getCellValue(undefined)).toBe('');
  });

  it('returns empty string for string "null"', () => {
    expect(getCellValue('null')).toBe('');
  });

  it('returns empty string for string "NULL"', () => {
    expect(getCellValue('NULL')).toBe('');
  });

  it('converts a number to string', () => {
    expect(getCellValue(42)).toBe('42');
  });

  it('returns string value as-is', () => {
    expect(getCellValue('hello')).toBe('hello');
  });
});

// ──────────────────────────────────────────────────────────
// getNumericValue
// ──────────────────────────────────────────────────────────

describe('getNumericValue', () => {
  it('parses a plain number string', () => {
    expect(getNumericValue('42')).toBe(42);
  });

  it('parses a number with commas', () => {
    expect(getNumericValue('1,500.50')).toBe(1500.5);
  });

  it('returns 0 for null', () => {
    expect(getNumericValue(null)).toBe(0);
  });

  it('returns 0 for empty string', () => {
    expect(getNumericValue('')).toBe(0);
  });

  it('returns 0 for non-numeric string', () => {
    expect(getNumericValue('abc')).toBe(0);
  });

  it('returns the numeric value for a number input', () => {
    expect(getNumericValue(123)).toBe(123);
  });

  it('returns 0 for string "null"', () => {
    expect(getNumericValue('null')).toBe(0);
  });
});
