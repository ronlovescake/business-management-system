import { describe, expect, it } from 'vitest';
import {
  buildAccountsReceivableShipmentEntries,
  calculateAccountsReceivableBalances,
  getAccountsReceivableRecognitionDate,
  getReservationDepositRecognitionCreditAccount,
  getTransactionRefundDebitAccount,
  getTransactionRefundDescription,
  getTransactionPaymentCreditAccount,
  getTransactionPaymentDebitAccount,
  hasAccountsReceivableShipment,
  getFinancialSourceTransaction,
} from '../transaction-recognition';

describe('Accounts Receivable shipment recognition', () => {
  it('keeps pre-invoice installments dated as revenue and recognizes only the remaining invoice revenue', () => {
    const transaction = {
      id: 1,
      orderStatus: 'Accounts Receivable',
      quantity: 1,
      unitPrice: 1000,
      shippedAt: new Date('2026-01-22'),
    };
    const payments = [
      {
        transactionId: 1,
        paymentDate: '2026-01-20',
        amount: 100,
        isReservation: true,
      },
      {
        transactionId: 1,
        paymentDate: '2026-01-20',
        amount: 300,
        isReservation: false,
      },
      {
        transactionId: 1,
        paymentDate: '2026-01-23',
        amount: 200,
        isReservation: false,
      },
    ];
    expect(
      getTransactionPaymentCreditAccount({ ...payments[1], transaction })
    ).toBe('Sales Revenue');
    expect(
      getTransactionPaymentCreditAccount({ ...payments[2], transaction })
    ).toBe('Accounts Receivable');
    expect(
      buildAccountsReceivableShipmentEntries(transaction, payments)
    ).toEqual([
      expect.objectContaining({ account: 'Accounts Receivable', debit: 700 }),
      expect.objectContaining({ account: 'Sales Revenue', credit: 700 }),
    ]);
    expect(
      getReservationDepositRecognitionCreditAccount({
        orderStatus: transaction.orderStatus,
        transaction,
        isForfeited: false,
      })
    ).toBe('Accounts Receivable');
  });

  it.each(['Prepared', 'Accounts Receivable'])(
    'keeps incoming card collections out of Cash and card debt for %s',
    (orderStatus) => {
      expect(
        getTransactionPaymentDebitAccount({
          method: 'CARD',
          transaction: { orderStatus },
        })
      ).toBe('Card Collections Clearing');
    }
  );
  it('uses the immutable pre-cancellation source without mutating the operational status', () => {
    const order = {
      orderStatus: 'Cancelled',
      cancellation: { previousStatus: 'Prepared' },
    };
    expect(getFinancialSourceTransaction(order).orderStatus).toBe('Prepared');
    expect(order.orderStatus).toBe('Cancelled');
  });

  it('settles an approved refund liability without creating another sales return', () => {
    expect(
      getTransactionRefundDebitAccount({
        orderStatus: 'Cancelled',
        isReservationRefund: false,
        isApprovedCancellationPayout: true,
      })
    ).toBe('Refunds Payable');
  });

  it('keeps voided reservation deposits in Customer Deposits until refunded', () => {
    expect(
      getReservationDepositRecognitionCreditAccount({
        orderStatus: 'Voided',
        isForfeited: false,
      })
    ).toBeNull();
    expect(
      getTransactionRefundDebitAccount({
        orderStatus: 'Voided',
        isReservationRefund: true,
      })
    ).toBe('Customer Deposits');
  });

  it('keeps delivered refunds as Sales Returns and buyer forfeitures distinct', () => {
    expect(
      getTransactionRefundDebitAccount({
        orderStatus: 'Shipped',
        isReservationRefund: false,
      })
    ).toBe('Sales Returns');
    expect(
      getTransactionRefundDebitAccount({
        orderStatus: 'Voided',
        isReservationRefund: false,
      })
    ).toBe('Sales Returns');
    expect(
      getReservationDepositRecognitionCreditAccount({
        orderStatus: 'Forfeited',
        isForfeited: true,
      })
    ).toBe('Forfeited Deposits');
  });

  it('labels voided reservation refunds clearly in journal descriptions', () => {
    expect(
      getTransactionRefundDescription({
        orderStatus: 'Voided',
        isReservationRefund: true,
        transactionId: 44,
        customerName: 'Shiela Marie Hambleton | Daisy Ella',
        reason: 'Supplier unavailable',
      })
    ).toBe(
      'Voided reservation refund • Shiela Marie Hambleton | Daisy Ella • TX-44 • Supplier unavailable'
    );
  });

  it('recognizes the persisted shipment timestamp after the order is fully paid', () => {
    const transaction = {
      orderStatus: 'Shipped',
      shippedAt: new Date('2026-10-23T12:00:00.000Z'),
      statusChanges: [],
    };

    expect(hasAccountsReceivableShipment(transaction)).toBe(true);
    expect(getAccountsReceivableRecognitionDate(transaction)).toEqual(
      new Date('2026-10-23T12:00:00.000Z')
    );
  });

  it('recognizes the earliest legacy Pending Payment status change', () => {
    const transaction = {
      orderStatus: 'Shipped',
      statusChanges: [
        {
          newStatus: 'Shipped',
          changedAt: new Date('2026-11-01T12:00:00.000Z'),
        },
        {
          newStatus: 'Pending Payment',
          changedAt: new Date('2026-09-01T12:00:00.000Z'),
        },
      ],
    };

    expect(hasAccountsReceivableShipment(transaction)).toBe(true);
    expect(getAccountsReceivableRecognitionDate(transaction)).toEqual(
      new Date('2026-09-01T12:00:00.000Z')
    );
  });

  it('falls back to packed date only while the transaction remains in A/R', () => {
    expect(
      getAccountsReceivableRecognitionDate({
        orderStatus: 'Accounts Receivable',
        packedDate: 'Oct 22, 2026',
      })
    ).toEqual(new Date('2026-10-22T00:00:00.000Z'));

    expect(
      getAccountsReceivableRecognitionDate({ orderStatus: 'Prepared' })
    ).toBeNull();
  });

  it('posts shipment revenue to A/R and reduces A/R for non-reservation collections', () => {
    const transaction = {
      id: 31,
      orderStatus: 'Accounts Receivable',
      quantity: 2,
      unitPrice: 100,
      adjustment: 25,
      lineTotal: 175,
      shippedAt: new Date('2026-10-23T12:00:00.000Z'),
      customers: 'Customer C',
      productCode: 'SKU-31',
    };

    expect(buildAccountsReceivableShipmentEntries(transaction)).toEqual([
      expect.objectContaining({
        account: 'Accounts Receivable',
        debit: 200,
        credit: 0,
        date: '2026-10-23T12:00:00.000Z',
      }),
      expect.objectContaining({
        account: 'Sales Revenue',
        debit: 0,
        credit: 200,
      }),
    ]);
    expect(
      getTransactionPaymentCreditAccount({ transaction, isReservation: false })
    ).toBe('Accounts Receivable');
    expect(
      getTransactionPaymentCreditAccount({ transaction, isReservation: true })
    ).toBe('Customer Deposits');
    expect(
      getTransactionPaymentDebitAccount({
        transaction,
        method: 'Bank Transfer',
      })
    ).toBe('Bank');
    expect(
      getTransactionPaymentDebitAccount({ transaction, method: 'GCash' })
    ).toBe('GCash');
    expect(
      getTransactionPaymentDebitAccount({
        transaction: { orderStatus: 'Shipped' },
        method: 'GCash',
      })
    ).toBe('Cash');
  });

  it('keeps full sale value in equity while reducing the remaining receivable', () => {
    expect(calculateAccountsReceivableBalances(200, 50)).toEqual({
      receivable: 150,
      recognizedSale: 200,
    });
    expect(calculateAccountsReceivableBalances(200, 200)).toEqual({
      receivable: 0,
      recognizedSale: 200,
    });
  });
});
