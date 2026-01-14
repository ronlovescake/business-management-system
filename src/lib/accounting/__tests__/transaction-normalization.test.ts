import { describe, expect, it } from 'vitest';
import {
  normalizeTransactionAmounts,
  normalizeTransactionAmountsForAccounting,
} from '../transaction-normalization';

describe('normalizeTransactionAmounts', () => {
  it('treats adjustment as payment received (cash basis)', () => {
    const amounts = normalizeTransactionAmounts({
      quantity: 2,
      unitPrice: 100,
      adjustment: 150,
      lineTotal: 50,
    });

    expect(amounts.grossSale).toBe(200);
    expect(amounts.paymentReceived).toBe(150);
    expect(amounts.balanceDue).toBe(50);
  });

  it('derives payment when adjustment is missing but lineTotal is present', () => {
    const amounts = normalizeTransactionAmounts({
      quantity: 2,
      unitPrice: 100,
      adjustment: null,
      lineTotal: 0,
    });

    expect(amounts.grossSale).toBe(200);
    expect(amounts.paymentReceived).toBe(200);
    expect(amounts.balanceDue).toBe(0);
  });

  it('handles missing numbers safely', () => {
    const amounts = normalizeTransactionAmounts({});
    expect(amounts.grossSale).toBe(0);
    expect(amounts.paymentReceived).toBe(0);
    expect(amounts.balanceDue).toBe(0);
  });
});

describe('normalizeTransactionAmountsForAccounting', () => {
  it('treats paid statuses as fully paid using grossSale', () => {
    const amounts = normalizeTransactionAmountsForAccounting({
      orderStatus: 'Checked Out',
      quantity: 2,
      unitPrice: 100,
      adjustment: 50, // ignored for paid statuses
      lineTotal: 150,
    });

    expect(amounts.grossSale).toBe(200);
    expect(amounts.paymentReceived).toBe(200);
    expect(amounts.balanceDue).toBe(0);
  });

  it('treats Pending Payment as deposit cash (adjustment) and derives balance', () => {
    const amounts = normalizeTransactionAmountsForAccounting({
      orderStatus: 'Pending Payment',
      quantity: 2,
      unitPrice: 100,
      adjustment: 50,
    });

    expect(amounts.grossSale).toBe(200);
    expect(amounts.paymentReceived).toBe(50);
    expect(amounts.balanceDue).toBe(150);
  });
});
