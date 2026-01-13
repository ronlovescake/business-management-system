import { describe, expect, it } from 'vitest';
import { normalizeTransactionAmounts } from '../transaction-normalization';

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
