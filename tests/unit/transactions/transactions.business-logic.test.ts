import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { calculateCancellationAmounts } from '@/lib/accounting/customer-money';
import {
  normalizeTransactionAmounts,
  normalizeTransactionAmountsForAccounting,
} from '@/lib/accounting/transaction-normalization';
import {
  hasMinimumCreateFields,
  computeRemainingBalance,
  createEmptyTransaction,
} from '@/modules/clothing/operations/transactions/hooks/transactionDraftUtils';
import { computeRemainingBalance as computeServiceRemainingBalance } from '@/modules/transactions/api/service-calculations';
import {
  computeCollectionBalance,
  computeOriginalDepositAgreement,
} from '@/modules/transactions/api/service-calculations';
import {
  truncateText,
  isPaidOrderStatus,
  describeTransaction,
} from '@/modules/clothing/operations/transactions/hooks/transactionOperationUtils';
import {
  getCellValue,
  getNumericValue,
} from '@/modules/clothing/operations/transactions/hooks/transactionCellValueUtils';

describe('original Reservation Deposit agreements', () => {
  const original = {
    quantity: 1,
    unitPrice: 1000,
    incomingAmount: 100,
    recordedPayments: 0,
    isReservation: true,
    originalDepositRate: 10 as const,
  };

  it.each([10, 20] as const)(
    'records an agreed %s percent deposit separately',
    (rate) => {
      const result = computeOriginalDepositAgreement({
        ...original,
        originalDepositRate: rate,
        incomingAmount: rate * 10,
      });
      expect('validationError' in result).toBe(false);
      if ('validationError' in result) {
        throw new Error(result.validationError);
      }
      expect(result.initialDepositAmount?.toNumber()).toBe(rate * 10);
      expect(result.initialDepositRate?.toNumber()).toBe(rate);
    }
  );

  it('requires explicit terms instead of guessing a percentage from the receipt', () => {
    expect(
      computeOriginalDepositAgreement({
        ...original,
        originalDepositRate: undefined,
      })
    ).toHaveProperty('validationError');
  });

  it('never overwrites an existing original agreement', () => {
    expect(
      computeOriginalDepositAgreement({
        ...original,
        initialDepositAmount: new Prisma.Decimal(200),
      })
    ).toHaveProperty('validationError');
  });

  it('does not infer historical agreements from prior collections', () => {
    expect(
      computeOriginalDepositAgreement({ ...original, recordedPayments: 50 })
    ).toHaveProperty('validationError');
  });

  it('rejects an amount that is not the agreed deposit', () => {
    expect(
      computeOriginalDepositAgreement({ ...original, incomingAmount: 200 })
    ).toHaveProperty('validationError');
  });

  it('leaves original terms unchanged when collecting installments', () => {
    expect(
      computeOriginalDepositAgreement({
        ...original,
        isReservation: false,
        originalDepositRate: undefined,
        recordedPayments: 100,
      })
    ).toEqual({});
  });
});

describe('approved cancellation money decisions', () => {
  const base = {
    kind: 'CANCELLED' as const,
    mode: 'RETAIN_DEPOSIT' as const,
    grossAmount: 1000,
    collectedAmount: 400,
    priorRefundAmount: 0,
    initialDepositAmount: 100,
    hasReceivableSale: true,
  };

  it.each([100, 200])(
    'retains the entire agreed deposit of %s without a ten-percent cap',
    (initialDepositAmount) => {
      expect(
        calculateCancellationAmounts({ ...base, initialDepositAmount })
      ).toMatchObject({
        retainedAmount: initialDepositAmount,
        approvedRefundAmount: 400 - initialDepositAmount,
        pendingAmount: 400 - initialDepositAmount,
        receivableCreditAmount: 600,
      });
    }
  );

  it('allows the approved emergency full refund without inventing a deposit agreement', () => {
    expect(
      calculateCancellationAmounts({
        ...base,
        mode: 'REFUND_ALL',
        initialDepositAmount: null,
      })
    ).toMatchObject({
      retainedAmount: 0,
      approvedRefundAmount: 400,
      receivableCreditAmount: 600,
    });
  });

  it('subtracts earlier actual repayments exactly once', () => {
    expect(
      calculateCancellationAmounts({ ...base, priorRefundAmount: 50 })
    ).toMatchObject({
      approvedRefundAmount: 250,
      pendingAmount: 250,
      retainedAmount: 100,
    });
  });

  it('does not turn unrecognized unpaid orders into an accounting credit', () => {
    expect(
      calculateCancellationAmounts({ ...base, hasReceivableSale: false })
    ).toMatchObject({ receivableCreditAmount: 0 });
  });

  it('never refunds an unpaid amount', () => {
    expect(
      calculateCancellationAmounts({
        ...base,
        mode: 'REFUND_ALL',
        collectedAmount: 0,
        initialDepositAmount: null,
      })
    ).toMatchObject({
      approvedRefundAmount: 0,
      pendingAmount: 0,
      receivableCreditAmount: 1000,
    });
  });

  it('requires original-deposit confirmation rather than guessing from payment rows', () => {
    expect(() =>
      calculateCancellationAmounts({ ...base, initialDepositAmount: null })
    ).toThrow('confirm the original deposit agreement');
  });

  it('rejects prior repayments that leave less money than the retained deposit', () => {
    expect(() =>
      calculateCancellationAmounts({ ...base, priorRefundAmount: 350 })
    ).toThrow('Earlier refunds');
  });

  it('rejects a cash history where refunds exceed collections', () => {
    expect(() =>
      calculateCancellationAmounts({ ...base, priorRefundAmount: 401 })
    ).toThrow('refunds exceed collected money');
  });

  it('requires a full available refund for supplier-failed Voided orders', () => {
    expect(() =>
      calculateCancellationAmounts({ ...base, kind: 'VOIDED' })
    ).toThrow('Supplier-failed orders cannot retain');
    expect(
      calculateCancellationAmounts({
        ...base,
        kind: 'VOIDED',
        mode: 'REFUND_ALL',
      })
    ).toMatchObject({ retainedAmount: 0, approvedRefundAmount: 400 });
  });

  it('keeps cents exact', () => {
    expect(
      calculateCancellationAmounts({
        ...base,
        grossAmount: 1,
        collectedAmount: 0.3,
        initialDepositAmount: 0.1,
      })
    ).toMatchObject({ approvedRefundAmount: 0.2, receivableCreditAmount: 0.7 });
  });
});

describe('approved new collection limits', () => {
  const base = {
    transactionId: 10,
    quantity: 1,
    unitPrice: 100,
    adjustment: 80,
    orderStatus: 'Prepared',
    recordedPayments: 80,
    incomingAmount: 20,
    isReservation: false,
  };

  it('accepts the exact outstanding amount without inventing another receipt', () => {
    expect(computeCollectionBalance(base)).toEqual({
      adjustment: 100,
      lineTotal: 0,
      orderStatus: 'Prepared',
    });
  });

  it('rejects even a one-cent overpayment', () => {
    expect(
      computeCollectionBalance({ ...base, incomingAmount: 20.01 })
    ).toHaveProperty(
      'validationError',
      'Payment exceeds the remaining balance for transaction 10.'
    );
  });

  it('requires review rather than discarding an unexplained legacy payment', () => {
    expect(
      computeCollectionBalance({ ...base, recordedPayments: 0 })
    ).toHaveProperty(
      'validationError',
      expect.stringContaining('legacy paid amount')
    );
  });

  it.each(['Cancelled', 'Forfeited', 'Voided'])(
    'rejects new collection on historical terminal status %s',
    (orderStatus) => {
      expect(computeCollectionBalance({ ...base, orderStatus })).toHaveProperty(
        'validationError'
      );
    }
  );

  it('keeps A/R debt collection separate from reservation deposits', () => {
    expect(
      computeCollectionBalance({
        ...base,
        orderStatus: 'Accounts Receivable',
        isReservation: true,
      })
    ).toHaveProperty('validationError');
    expect(
      computeCollectionBalance({ ...base, orderStatus: 'Accounts Receivable' })
    ).toEqual({ adjustment: 100, lineTotal: 0, orderStatus: 'Shipped' });
  });

  it('does not create a one-cent balance from decimal addition', () => {
    expect(
      computeCollectionBalance({
        ...base,
        unitPrice: 0.3,
        adjustment: 0.1,
        recordedPayments: 0.1,
        incomingAmount: 0.2,
      })
    ).toMatchObject({ adjustment: 0.3, lineTotal: 0 });
  });
});

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

  it('computes balance from net unit price and adjustment when lineTotal is missing', () => {
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
    expect(computeRemainingBalance(row)).toBe(500);
  });

  it.each([null, undefined, NaN, ''])(
    'uses the net-price fallback for absent total %s',
    (lineTotal) => {
      const row = {
        ...createEmptyTransaction(),
        Quantity: 10,
        'Unit Price': 95,
        Discount: 5,
        Adjustment: 900,
        'Line Total': lineTotal as number,
      };
      expect(computeRemainingBalance(row)).toBe(50);
      expect(
        computeServiceRemainingBalance({
          lineTotal,
          quantity: 10,
          unitPrice: 95,
          discount: 5,
          adjustment: 900,
        })
      ).toBe(50);
    }
  );

  it.each([0, '0'])('preserves an explicit zero total %s', (lineTotal) => {
    expect(
      computeRemainingBalance({
        ...createEmptyTransaction(),
        Quantity: 10,
        'Unit Price': 95,
        'Line Total': lineTotal as number,
      })
    ).toBe(0);
    expect(
      computeServiceRemainingBalance({
        lineTotal,
        quantity: 10,
        unitPrice: 95,
        discount: 5,
        adjustment: 0,
      })
    ).toBe(0);
  });

  it('preserves a negative adjustment surcharge in the fallback', () => {
    expect(
      computeServiceRemainingBalance({
        lineTotal: null,
        quantity: 10,
        unitPrice: 95,
        discount: 5,
        adjustment: -50,
      })
    ).toBe(1000);
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
