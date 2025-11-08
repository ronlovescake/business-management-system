import { renderHook, act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTransactionOperations } from '@/modules/clothing/operations/transactions/hooks/useTransactionOperations';
import type {
  PriceTier,
  TransactionData,
} from '@/modules/clothing/operations/transactions/types/transaction.types';
import { notifications } from '@mantine/notifications';
import type {
  CellEditEvent,
  HandsontableColumn,
} from '@/components/ui/HandsontableGrid';

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: vi.fn(),
  },
  showNotification: vi.fn(),
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
  beforeEach(() => {
    vi.mocked(notifications.show).mockClear();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'IN_STOCK',
        message: 'Stock available',
        availableStock: 100,
        canFulfill: true,
      }),
    });

    global.fetch = fetchMock as unknown as typeof fetch;
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

    const fetchSpy = global.fetch as unknown as ReturnType<typeof vi.fn>;

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/inventory/check-stock',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
