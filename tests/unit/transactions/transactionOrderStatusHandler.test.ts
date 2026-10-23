import { describe, expect, it, vi } from 'vitest';
import { handleOrderStatusColumnEdit } from '@/modules/clothing/operations/transactions/hooks/transactionOrderStatusHandler';
import type { TransactionData } from '@/modules/clothing/operations/transactions/types/transaction.types';

describe('handleOrderStatusColumnEdit', () => {
  const baseTransaction: TransactionData = {
    id: 101,
    'Order Date': '2026-03-01',
    Customers: 'Mock Customer',
    'Product Code': 'SKU-001',
    Quantity: 4,
    'Unit Price': 125,
    Discount: 0,
    Adjustment: 0,
    'Line Total': 500,
    'Order Status': 'In Transit',
    Notes: 'Initial note',
    'Invoice Date': '',
    'Packed Date': '',
    'Shipment Code': 'SHIP-001',
    version: 1,
  };

  it('updates a non-terminal order status and notifies success', async () => {
    const notify = vi.fn();
    const updateTransactionData = vi.fn();
    const logNotification = vi.fn();

    const handled = await handleOrderStatusColumnEdit({
      columnId: 'orderStatus',
      rawValue: 'Warehouse',
      transaction: baseTransaction,
      transactionDescriptor: 'TX-101',
      shouldLog: true,
      isPaidOrderStatus: () => false,
      isVoidedOrderStatus: () => false,
      formatCurrencyValue: (value) => `PHP ${value.toFixed(2)}`,
      notify,
      updateTransactionData,
      logNotification,
      fireAlert: vi.fn(),
    });

    expect(handled).toBe(true);
    expect(updateTransactionData).toHaveBeenCalledWith({
      'Order Status': 'Warehouse',
    });
    expect(notify).toHaveBeenCalledWith({
      title: 'Success',
      message: 'Order Status updated successfully',
      color: 'green',
    });
    expect(logNotification).toHaveBeenCalledWith(
      'Order Status changed from In Transit to Warehouse for TX-101.',
      {
        column: 'Order Status',
        transactionId: 101,
        previousValue: 'In Transit',
        newValue: 'Warehouse',
      }
    );
  });

  it('blocks paid statuses when balance remains', async () => {
    const fireAlert = vi.fn().mockResolvedValue({ isConfirmed: true });
    const notify = vi.fn();
    const updateTransactionData = vi.fn();

    const handled = await handleOrderStatusColumnEdit({
      columnId: 'orderStatus',
      rawValue: 'Shipped',
      transaction: {
        ...baseTransaction,
        Adjustment: 100,
        Quantity: 2,
        'Unit Price': 125,
        Discount: 0,
        'Line Total': 250,
      },
      transactionDescriptor: 'TX-101',
      shouldLog: false,
      isPaidOrderStatus: (value) => value === 'Shipped',
      isVoidedOrderStatus: () => false,
      formatCurrencyValue: (value) => `PHP ${value.toFixed(2)}`,
      notify,
      updateTransactionData,
      logNotification: vi.fn(),
      fireAlert,
    });

    expect(handled).toBe(true);
    expect(fireAlert).toHaveBeenCalledTimes(1);
    expect(updateTransactionData).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it('does not notify success until the status save completes', async () => {
    const notify = vi.fn();
    const logNotification = vi.fn();
    const deferred = { resolve: () => {} };
    const save = new Promise<void>((resolve) => {
      deferred.resolve = resolve;
    });
    const result = handleOrderStatusColumnEdit({
      columnId: 'orderStatus',
      rawValue: 'Accounts Receivable',
      transaction: baseTransaction,
      transactionDescriptor: 'TX-101',
      shouldLog: true,
      isPaidOrderStatus: () => false,
      isVoidedOrderStatus: () => false,
      formatCurrencyValue: String,
      notify,
      updateTransactionData: () => save,
      logNotification,
      fireAlert: vi.fn(),
    });

    expect(notify).not.toHaveBeenCalled();
    expect(logNotification).not.toHaveBeenCalled();
    deferred.resolve();
    await result;
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'green' })
    );
  });

  it('shows a rejected save without reporting success or logging a status change', async () => {
    const notify = vi.fn();
    const logNotification = vi.fn();
    await handleOrderStatusColumnEdit({
      columnId: 'orderStatus',
      rawValue: 'Accounts Receivable',
      transaction: baseTransaction,
      transactionDescriptor: 'TX-101',
      shouldLog: true,
      isPaidOrderStatus: () => false,
      isVoidedOrderStatus: () => false,
      formatCurrencyValue: String,
      notify,
      updateTransactionData: vi
        .fn()
        .mockRejectedValue(new Error('Failed to save transaction')),
      logNotification,
      fireAlert: vi.fn(),
    });

    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith({
      title: 'Order Status not saved',
      message: 'Failed to save transaction',
      color: 'red',
    });
    expect(logNotification).not.toHaveBeenCalled();
  });

  it('logs the canonical status returned by the server', async () => {
    const logNotification = vi.fn();
    await handleOrderStatusColumnEdit({
      columnId: 'orderStatus',
      rawValue: 'Accounts Receivable',
      transaction: { ...baseTransaction, 'Line Total': 0 },
      transactionDescriptor: 'TX-101',
      shouldLog: true,
      isPaidOrderStatus: () => false,
      isVoidedOrderStatus: () => false,
      formatCurrencyValue: String,
      notify: vi.fn(),
      updateTransactionData: vi
        .fn()
        .mockResolvedValue({ 'Order Status': 'Shipped' }),
      logNotification,
      fireAlert: vi.fn(),
    });

    expect(logNotification).toHaveBeenCalledWith(
      expect.stringContaining('to Shipped'),
      expect.objectContaining({ newValue: 'Shipped' })
    );
  });
});
