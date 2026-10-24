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

  it('opens customer details only after a confirmed Voided status save', async () => {
    const order: string[] = [];
    const fireAlert = vi.fn().mockResolvedValue({ isConfirmed: true });
    const onVoidedStatusSaved = vi.fn(async (customerName: string) => {
      order.push(`customer:${customerName}`);
    });
    const updateTransactionData = vi.fn(async () => {
      order.push('saved');
      return { 'Order Status': 'Voided' as const };
    });

    await handleOrderStatusColumnEdit({
      columnId: 'orderStatus',
      rawValue: 'Voided',
      transaction: { ...baseTransaction, Adjustment: 474 },
      transactionDescriptor: 'TX-101',
      shouldLog: false,
      isPaidOrderStatus: () => false,
      isVoidedOrderStatus: (value) => value === 'Voided',
      formatCurrencyValue: (value) => `PHP ${value.toFixed(2)}`,
      notify: vi.fn(),
      updateTransactionData,
      logNotification: vi.fn(),
      onVoidedStatusSaved,
      fireAlert,
    });

    expect(order).toEqual(['saved', 'customer:Mock Customer']);
    expect(onVoidedStatusSaved).toHaveBeenCalledWith('Mock Customer');
    expect(fireAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmButtonText: 'Mark as Voided',
        cancelButtonText: 'Cancel',
        html: expect.stringContaining('customer details popup will open'),
      })
    );
    expect(fireAlert.mock.calls[0]?.[0]).not.toHaveProperty('showDenyButton');
    expect(fireAlert.mock.calls[0]?.[0]).not.toHaveProperty('denyButtonText');
  });

  it('does not open customer details when Voided confirmation is cancelled', async () => {
    const onVoidedStatusSaved = vi.fn();
    const updateTransactionData = vi.fn();

    await handleOrderStatusColumnEdit({
      columnId: 'orderStatus',
      rawValue: 'Voided',
      transaction: { ...baseTransaction, Adjustment: 474 },
      transactionDescriptor: 'TX-101',
      shouldLog: false,
      isPaidOrderStatus: () => false,
      isVoidedOrderStatus: (value) => value === 'Voided',
      formatCurrencyValue: String,
      notify: vi.fn(),
      updateTransactionData,
      logNotification: vi.fn(),
      onVoidedStatusSaved,
      fireAlert: vi.fn().mockResolvedValue({ isConfirmed: false }),
    });

    expect(updateTransactionData).not.toHaveBeenCalled();
    expect(onVoidedStatusSaved).not.toHaveBeenCalled();
  });

  it('does not show the refund reminder or open customer details without payment', async () => {
    const fireAlert = vi.fn();
    const onVoidedStatusSaved = vi.fn();

    await handleOrderStatusColumnEdit({
      columnId: 'orderStatus',
      rawValue: 'Voided',
      transaction: { ...baseTransaction, Adjustment: 0 },
      transactionDescriptor: 'TX-101',
      shouldLog: false,
      isPaidOrderStatus: () => false,
      isVoidedOrderStatus: (value) => value === 'Voided',
      formatCurrencyValue: String,
      notify: vi.fn(),
      updateTransactionData: vi.fn().mockResolvedValue({
        'Order Status': 'Voided',
      }),
      logNotification: vi.fn(),
      onVoidedStatusSaved,
      fireAlert,
    });

    expect(fireAlert).not.toHaveBeenCalled();
    expect(onVoidedStatusSaved).not.toHaveBeenCalled();
  });
});
