import { describe, expect, it } from 'vitest';
import {
  buildAccountsReceivableShipmentEntries,
  calculateAccountsReceivableBalances,
  getAccountsReceivableRecognitionDate,
  getTransactionPaymentCreditAccount,
  getTransactionPaymentDebitAccount,
  hasAccountsReceivableShipment,
} from '../transaction-recognition';

describe('Accounts Receivable shipment recognition', () => {
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
