import { describe, expect, it } from 'vitest';
import {
  computeTransactionRefundLimit,
  validateCumulativeRefundLimits,
} from '../transaction-refund.validation';

describe('transaction refund limits', () => {
  it('includes prior payments when computing the maximum refundable amount', () => {
    expect(
      computeTransactionRefundLimit({
        lineTotal: 25,
        adjustment: 75,
        quantity: 2,
        unitPrice: 50,
        discount: 0,
      })
    ).toBe(100);
  });

  it('rejects cumulative refunds above the transaction amount', () => {
    expect(
      validateCumulativeRefundLimits({
        transactionAmount: 100,
        transactionQuantity: 5,
        existingRefunds: [{ amount: 80, returnedQuantity: 1 }],
        amount: 20.01,
        returnedQuantity: 0,
      })
    ).toEqual({
      field: 'amount',
      message: 'Total refunds cannot exceed the original transaction amount.',
    });
  });

  it('rejects cumulative returned quantity above the order quantity', () => {
    expect(
      validateCumulativeRefundLimits({
        transactionAmount: 100,
        transactionQuantity: 5,
        existingRefunds: [{ amount: 20, returnedQuantity: 4 }],
        amount: 0,
        returnedQuantity: 1.01,
      })
    ).toMatchObject({ field: 'returnedQuantity' });
  });
});
