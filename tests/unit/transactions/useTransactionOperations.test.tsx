import { renderHook, act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTransactionOperations } from '@/modules/clothing/operations/transactions/hooks/useTransactionOperations';
import { TransactionService } from '@/modules/clothing/operations/transactions/services/TransactionService';
import { api } from '@/lib/api/client';
import type {
  PriceTier,
  TransactionData,
} from '@/modules/clothing/operations/transactions/types/transaction.types';
import { notifications, showNotification } from '@mantine/notifications';
import { useTransactionBatchMode } from '@/modules/clothing/operations/transactions/hooks/useTransactionBatchMode';
import type {
  CellEditEvent,
  HandsontableColumn,
} from '@/components/ui/HandsontableGrid';

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
  }),
}));

vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: vi.fn(),
  },
  showNotification: vi.fn(),
}));

vi.mock('@/lib/alerts', () => ({
  showConfirm: vi.fn().mockResolvedValue(true),
  getSwal: vi.fn().mockResolvedValue({
    fire: vi.fn().mockResolvedValue({ isConfirmed: true }),
  }),
}));

const priceTiers: PriceTier[] = [
  {
    'Product Code': 'SKU-1',
    'Lower Limit': 1,
    'Upper Limit': 10,
    Prices: 250,
  },
];

const baseTransaction: TransactionData = {
  id: 1,
  'Order Date': '',
  Customers: 'Acme Corp',
  'Product Code': '',
  Quantity: 5,
  'Unit Price': null,
  Discount: 10,
  Adjustment: 0,
  'Line Total': null,
  'Order Status': 'In Transit',
  Notes: '',
  'Invoice Date': '',
  'Packed Date': '',
  'Shipment Code': '-',
};

const createProps = () => {
  const transactions = [structuredClone(baseTransaction)];
  const filteredData = [structuredClone(baseTransaction)];

  return {
    transactions,
    filteredData,
    priceTiers,
    productToShipmentMap: { 'SKU-1': 'SHIP-001' },
    productToShipmentStatusMap: { 'SKU-1': 'Delivered' },
    bulkUpdate: vi.fn(),
    update: vi.fn(),
    onCustomerWarning: vi.fn(),
  };
};

describe('useTransactionOperations', () => {
  it('keeps edits queued behind creation attached to the real saved ID', async () => {
    let acknowledge!: (result: unknown) => void;
    const post = vi.spyOn(api, 'post').mockImplementation(
      () =>
        new Promise((resolve) => {
          acknowledge = resolve;
        })
    );
    const props = createProps();
    const placeholder = {
      ...baseTransaction,
      id: undefined,
      'Order Date': '2026-10-25',
    };
    const finish = vi.fn();
    const replacePlaceholder = vi.fn();
    const { result } = renderHook(() =>
      useTransactionOperations({
        ...props,
        filteredData: [placeholder],
        beginDraft: () => finish,
        replacePlaceholder,
      })
    );
    const edit = {
      column: { id: 'notes', title: 'NOTES' } as HandsontableColumn,
      columnId: 'notes',
      columnIndex: 9,
      row: 0,
      rowData: placeholder,
      oldValue: '',
      source: 'edit',
    };
    let first!: Promise<unknown>;
    let later!: Promise<unknown>;
    act(() => {
      first = Promise.resolve(
        result.current.handleCellEdited({ ...edit, value: 'first' })
      );
    });
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(result.current.hasDrafts).toBe(true);
    act(() => {
      later = Promise.resolve(
        result.current.handleCellEdited({ ...edit, value: 'later' })
      );
    });
    await act(async () => {
      acknowledge({
        count: 1,
        transactions: [
          { ...placeholder, id: 70, revision: 'a'.repeat(64), Notes: 'first' },
        ],
      });
      await first;
      await later;
    });
    expect(
      post.mock.calls.filter(([url]) => url.endsWith('/transactions'))
    ).toHaveLength(1);
    expect(props.update).toHaveBeenCalledWith({
      id: 70,
      data: { Notes: 'later' },
    });
    expect(replacePlaceholder).toHaveBeenCalledWith(placeholder);
    expect(finish).toHaveBeenCalledTimes(1);
    expect(result.current.hasDrafts).toBe(false);
    post.mockRestore();
  });

  it('retries an uncertain creation with the same frozen key and preserves later draft fields', async () => {
    const post = vi
      .spyOn(api, 'post')
      .mockRejectedValueOnce(new Error('response lost'));
    const props = createProps();
    const placeholder = {
      ...baseTransaction,
      id: undefined,
      'Order Date': '2026-10-25',
    };
    const saveBulkChanges = vi.fn().mockResolvedValue({ count: 1 });
    const { result } = renderHook(() =>
      useTransactionOperations({
        ...props,
        filteredData: [placeholder],
        saveBulkChanges,
      })
    );
    const edit = {
      column: { id: 'notes', title: 'NOTES' } as HandsontableColumn,
      columnId: 'notes',
      columnIndex: 9,
      row: 0,
      rowData: placeholder,
      oldValue: '',
      source: 'edit',
    };
    await act(async () => {
      await result.current.handleCellEdited({ ...edit, value: 'first' });
    });
    expect(result.current.draftError).toBe('response lost');
    await act(async () => {
      await result.current.handleCellEdited({ ...edit, value: 'later' });
    });
    expect(post).toHaveBeenCalledTimes(1);
    post.mockResolvedValue({
      count: 1,
      transactions: [
        { ...placeholder, id: 71, revision: 'a'.repeat(64), Notes: 'first' },
      ],
    });
    await act(async () => {
      await result.current.retryDrafts();
    });
    expect(post.mock.calls[1][1]).toEqual(post.mock.calls[0][1]);
    expect(saveBulkChanges).toHaveBeenCalledWith([
      { id: 71, data: { Notes: 'later' } },
    ]);
    post.mockRestore();
  });

  it('tracks incomplete drafts until explicitly discarded', async () => {
    const props = createProps();
    const placeholder = {
      ...baseTransaction,
      id: undefined,
      Customers: '',
      'Product Code': '',
    };
    const finish = vi.fn();
    const { result } = renderHook(() =>
      useTransactionOperations({
        ...props,
        filteredData: [placeholder],
        beginDraft: () => finish,
      })
    );
    await act(async () => {
      await result.current.handleCellEdited({
        column: { id: 'notes', title: 'NOTES' } as HandsontableColumn,
        columnId: 'notes',
        columnIndex: 9,
        row: 0,
        rowData: placeholder,
        oldValue: '',
        value: 'draft',
        source: 'edit',
      });
    });
    expect(result.current.hasDrafts).toBe(true);
    act(() => result.current.discardDrafts());
    expect(result.current.hasDrafts).toBe(false);
    expect(placeholder.Notes).toBe('');
    expect(finish).toHaveBeenCalledTimes(1);
  });
  it('ignores cancel from an older customer warning after another selection', async () => {
    const validate = vi
      .spyOn(TransactionService, 'validateCustomer')
      .mockResolvedValue({ isValid: true, warnings: ['warning'] });
    const props = createProps();
    const { result } = renderHook(() => useTransactionOperations(props));
    const edit = {
      column: { id: 'customers', title: 'CUSTOMERS' } as HandsontableColumn,
      columnId: 'customers',
      columnIndex: 1,
      row: 0,
      rowData: props.filteredData[0],
      oldValue: 'Acme Corp',
      source: 'edit',
    };
    await act(async () => {
      await result.current.handleCellEdited({ ...edit, value: 'First' });
    });
    const oldWarning = props.onCustomerWarning.mock.calls[0][0];
    await act(async () => {
      await result.current.handleCellEdited({ ...edit, value: 'Second' });
    });
    props.update.mockClear();
    await act(async () => {
      oldWarning.onCancel();
    });
    expect(props.update).not.toHaveBeenCalled();
    validate.mockRestore();
  });
  it('does not flush an older paste field over a newer individual edit', async () => {
    const props = createProps();
    const saveBulkChanges = vi.fn().mockResolvedValue({ count: 1 });
    const { result } = renderHook(() =>
      useTransactionOperations({ ...props, saveBulkChanges })
    );
    const edit = {
      column: { id: 'notes', title: 'NOTES' },
      columnId: 'notes',
      columnIndex: 9,
      row: 0,
      rowData: props.filteredData[0],
      oldValue: '',
      source: 'edit',
    };
    await act(async () => {
      window.dispatchEvent(new Event('handsontable-batch-start'));
      await result.current.handleCellEdited({
        ...edit,
        value: 'paste',
        isBatch: true,
      });
      await result.current.handleCellEdited({
        ...edit,
        value: 'newer',
        isBatch: false,
      });
      window.dispatchEvent(
        new CustomEvent('handsontable-batch-complete', { detail: { count: 1 } })
      );
    });
    expect(props.update).toHaveBeenCalledWith({
      id: 1,
      data: { Notes: 'newer' },
    });
    expect(saveBulkChanges).not.toHaveBeenCalled();
  });

  it('does not clear earlier edits when paste batches overlap', async () => {
    const props = createProps();
    const saveBulkChanges = vi.fn().mockResolvedValue({ count: 1 });
    const logNotification = vi.fn();
    const { result } = renderHook(() =>
      useTransactionBatchMode({
        transactions: props.transactions,
        bulkUpdate: props.bulkUpdate,
        saveBulkChanges,
        logNotification,
      })
    );
    await act(async () => {
      window.dispatchEvent(new Event('handsontable-batch-start'));
      result.current.batchUpdatesRef.current.set(1, { Notes: 'first paste' });
      window.dispatchEvent(new Event('handsontable-batch-start'));
      result.current.batchUpdatesRef.current.set(1, {
        ...result.current.batchUpdatesRef.current.get(1),
        Quantity: 8,
      });
      window.dispatchEvent(
        new CustomEvent('handsontable-batch-complete', { detail: { count: 1 } })
      );
    });
    expect(saveBulkChanges).not.toHaveBeenCalled();
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('handsontable-batch-complete', { detail: { count: 1 } })
      );
    });
    expect(saveBulkChanges).toHaveBeenCalledWith([
      { id: 1, data: { Notes: 'first paste', Quantity: 8 } },
    ]);
    expect(logNotification).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ cellsEdited: 2 })
    );
  });

  it('supersedes a pending pasted status before an individual status save', async () => {
    const props = createProps();
    props.filteredData[0]['Product Code'] = 'SKU-1';
    const saveBulkChanges = vi.fn().mockResolvedValue({ count: 1 });
    const saveOrderStatus = vi
      .fn()
      .mockResolvedValue({ 'Order Status': 'Prepared' });
    const { result } = renderHook(() =>
      useTransactionOperations({ ...props, saveBulkChanges, saveOrderStatus })
    );
    const edit: CellEditEvent = {
      column: {
        id: 'orderStatus',
        title: 'ORDER STATUS',
      } as HandsontableColumn,
      columnId: 'orderStatus',
      columnIndex: 8,
      row: 0,
      rowData: props.filteredData[0],
      oldValue: 'In Transit',
      value: 'Warehouse',
      isBatch: true,
      source: 'edit',
    };
    await act(async () => {
      window.dispatchEvent(new Event('handsontable-batch-start'));
      await result.current.handleCellEdited(edit);
      await result.current.handleCellEdited({
        ...edit,
        value: 'Prepared',
        oldValue: 'Warehouse',
        isBatch: false,
      });
      window.dispatchEvent(
        new CustomEvent('handsontable-batch-complete', { detail: { count: 1 } })
      );
    });
    expect(saveOrderStatus).toHaveBeenCalledWith(1, 'Prepared');
    expect(saveBulkChanges).not.toHaveBeenCalled();
  });

  beforeEach(() => {
    vi.mocked(notifications.show).mockClear();
    vi.mocked(showNotification).mockClear();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'IN_STOCK',
        message: 'Stock available',
        availableStock: 100,
        canFulfill: true,
      }),
    });

    global.fetch = fetchMock as typeof fetch;
  });

  it('awaits the confirmed status save rather than the fire-and-forget mutation', async () => {
    const props = createProps();
    const deferred = {
      resolve: (_value: Pick<TransactionData, 'Order Status'>) => {},
    };
    const saved = new Promise<Pick<TransactionData, 'Order Status'>>(
      (resolve) => {
        deferred.resolve = resolve;
      }
    );
    const saveOrderStatus = vi.fn().mockReturnValue(saved);
    const { result } = renderHook(() =>
      useTransactionOperations({ ...props, saveOrderStatus })
    );
    let edit: void | boolean | Promise<void | boolean>;
    act(() => {
      edit = result.current.handleCellEdited({
        column: { id: 'orderStatus', title: 'ORDER STATUS' },
        columnId: 'orderStatus',
        columnIndex: 8,
        row: 0,
        rowData: props.filteredData[0],
        value: 'Accounts Receivable',
        oldValue: 'Prepared',
        isBatch: false,
        source: 'edit',
      });
    });
    await waitFor(() =>
      expect(saveOrderStatus).toHaveBeenCalledWith(1, 'Accounts Receivable')
    );
    expect(props.update).not.toHaveBeenCalled();
    expect(showNotification).not.toHaveBeenCalled();
    await act(async () => {
      deferred.resolve({ 'Order Status': 'Accounts Receivable' });
      await edit;
    });
    expect(showNotification).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'green' })
    );
  });

  it('forwards the customer callback only after a Voided save resolves', async () => {
    const props = createProps();
    props.transactions[0].Adjustment = 474;
    props.filteredData[0].Adjustment = 474;
    const onVoidedStatusSaved = vi.fn();
    const deferred = {
      resolve: (_value: Pick<TransactionData, 'Order Status'>) => {},
    };
    const saveOrderStatus = vi.fn().mockReturnValue(
      new Promise<Pick<TransactionData, 'Order Status'>>((resolve) => {
        deferred.resolve = resolve;
      })
    );
    const { result } = renderHook(() =>
      useTransactionOperations({
        ...props,
        saveOrderStatus,
        onVoidedStatusSaved,
      })
    );

    let edit: void | boolean | Promise<void | boolean>;
    act(() => {
      edit = result.current.handleCellEdited({
        column: { id: 'orderStatus', title: 'ORDER STATUS' },
        columnId: 'orderStatus',
        columnIndex: 8,
        row: 0,
        rowData: props.filteredData[0],
        value: 'Voided',
        oldValue: 'In Transit',
        isBatch: false,
        source: 'edit',
      });
    });

    await waitFor(() =>
      expect(saveOrderStatus).toHaveBeenCalledWith(1, 'Voided')
    );
    expect(onVoidedStatusSaved).not.toHaveBeenCalled();

    await act(async () => {
      deferred.resolve({ 'Order Status': 'Voided' });
      await edit;
    });

    expect(onVoidedStatusSaved).toHaveBeenCalledWith('Acme Corp');
  });

  it('reports batch success only after the confirmed bulk save completes', async () => {
    const props = createProps();
    const deferred = { resolve: (_value: { count: number }) => {} };
    const saved = new Promise<{ count: number }>((resolve) => {
      deferred.resolve = resolve;
    });
    const saveBulkUpdate = vi.fn().mockReturnValue(saved);
    const logNotification = vi.fn();
    const { result } = renderHook(() =>
      useTransactionBatchMode({
        transactions: props.transactions,
        bulkUpdate: props.bulkUpdate,
        saveBulkUpdate,
        logNotification,
      })
    );
    act(() => {
      window.dispatchEvent(new Event('handsontable-batch-start'));
      result.current.batchUpdatesRef.current.set(1, {
        'Order Status': 'Accounts Receivable',
      });
      window.dispatchEvent(
        new CustomEvent('handsontable-batch-complete', { detail: { count: 1 } })
      );
    });
    expect(saveBulkUpdate).toHaveBeenCalledTimes(1);
    expect(showNotification).not.toHaveBeenCalled();
    expect(logNotification).not.toHaveBeenCalled();
    expect(result.current.isBatchModeRef.current).toBe(false);
    await act(async () => {
      deferred.resolve({ count: 1 });
    });
    expect(showNotification).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'green' })
    );
    expect(logNotification).toHaveBeenCalledTimes(1);
  });

  it('shows a batch rejection without success or a persisted-change log', async () => {
    const props = createProps();
    const logNotification = vi.fn();
    const { result } = renderHook(() =>
      useTransactionBatchMode({
        transactions: props.transactions,
        bulkUpdate: props.bulkUpdate,
        saveBulkUpdate: vi
          .fn()
          .mockRejectedValue(new Error('Batch save rejected')),
        logNotification,
      })
    );
    await act(async () => {
      window.dispatchEvent(new Event('handsontable-batch-start'));
      result.current.batchUpdatesRef.current.set(1, {
        'Order Status': 'Accounts Receivable',
      });
      window.dispatchEvent(
        new CustomEvent('handsontable-batch-complete', { detail: { count: 1 } })
      );
    });
    expect(showNotification).toHaveBeenCalledTimes(1);
    expect(showNotification).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'red', message: 'Batch save rejected' })
    );
    expect(logNotification).not.toHaveBeenCalled();
    expect(result.current.isBatchModeRef.current).toBe(false);
    expect(result.current.batchUpdatesRef.current.size).toBe(0);
  });

  it('auto-populates shipment code, status, and unit price when product code changes', async () => {
    const props = createProps();
    const { result } = renderHook(() => useTransactionOperations(props));

    await act(async () => {
      const column: HandsontableColumn = {
        id: 'productCode',
        title: 'PRODUCT CODE',
      };

      const editEvent: CellEditEvent<TransactionData> = {
        column,
        columnId: 'productCode',
        columnIndex: 2,
        row: 0,
        rowData: props.filteredData[0],
        value: 'SKU-1',
        oldValue: '',
        isBatch: false,
        source: 'edit',
      };

      await result.current.handleCellEdited(editEvent);
    });

    await waitFor(() => {
      expect(props.update).toHaveBeenCalledTimes(1);
    });

    expect(props.update).toHaveBeenCalledWith({
      id: 1,
      data: expect.objectContaining({
        'Product Code': 'SKU-1',
        'Shipment Code': 'SHIP-001',
        'Order Status': 'Warehouse',
        'Unit Price': 240,
      }),
    });

    const fetchSpy = global.fetch as ReturnType<typeof vi.fn>;

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/inventory/check-stock',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
