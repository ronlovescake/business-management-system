import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { fireEvent, screen } from '@testing-library/dom';
import { MantineProvider } from '@mantine/core';
import { InventoryPage } from '../InventoryPage';
import type {
  InventoryItem,
  InventoryMovementFromAPI,
  InventoryTotals,
  ProductFromAPI,
} from '../../types';

const mockUseInventoryPage = vi.fn();

vi.mock('@mantine/notifications', () => ({
  showNotification: vi.fn(),
}));

vi.mock('@mantine/core', async () => {
  const actual = await vi.importActual('@mantine/core');
  const core = actual as {
    Table: {
      Tr: React.ComponentType<React.ComponentProps<'tr'>>;
      Td: React.ComponentType<React.ComponentProps<'td'>>;
    };
  } & Record<string, unknown>;

  return {
    ...core,
    Table: {
      ...core.Table,
      Tr: ({ children, ...props }: React.ComponentProps<'tr'>) => (
        <tr {...props}>{children}</tr>
      ),
      Td: ({ children, ...props }: React.ComponentProps<'td'>) => (
        <td {...props}>{children}</td>
      ),
    },
  };
});

vi.mock('../../hooks/useInventoryPage', () => ({
  useInventoryPage: () => mockUseInventoryPage(),
}));

vi.mock('../InventoryTableControls', () => ({
  InventoryTableControls: ({
    searchAddon,
  }: {
    searchAddon?: React.ReactNode;
  }) => (
    <div>
      <div>inventory-controls</div>
      {searchAddon}
    </div>
  ),
}));

vi.mock('../InventorySummary', () => ({
  InventorySummary: () => <div>inventory-summary</div>,
}));

vi.mock('../InventoryTable', () => ({
  InventoryTable: () => <div>inventory-table</div>,
}));

vi.mock('@/components/tables/StandardDataTable', () => ({
  StandardTableContainer: ({
    children,
    summary,
  }: {
    children: React.ReactNode;
    summary?: React.ReactNode;
  }) => (
    <div>
      {summary}
      {children}
    </div>
  ),
  StandardDataTable: ({
    headers,
    children,
  }: {
    headers: string[];
    children: React.ReactNode;
  }) => (
    <table>
      <thead>
        <tr>
          {headers.map((header) => (
            <th key={header}>{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  ),
}));

vi.mock('@/components/modals/UniversalModal', () => ({
  UniversalModal: ({
    opened,
    title,
    children,
  }: {
    opened: boolean;
    title: string;
    children: React.ReactNode;
  }) =>
    opened ? (
      <div role="dialog" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    ) : null,
}));

const createInventoryItem = (productCode: string): InventoryItem => ({
  id: '1',
  productCode,
  quantity: 100,
  actualQuantityReceived: 100,
  sellableOnHand: 90,
  reservedOnHand: 0,
  onHandSellable: 90,
  onHandReserved: 0,
  inTransitUnreserved: 0,
  inTransitReserved: 0,
  soldQty: 0,
  damagedOnHand: 10,
  scrapQty: 0,
  additionalsQty: 0,
  onhand: 100,
  availableStock: 90,
  supplierShortQty: 0,
  totalSales: 0,
  cogs: 0,
  netProfit: 0,
  percentage: 0,
  endingInventoryValue: 0,
  shipmentCode: '',
  shipmentStatus: '',
});

const createTotals = (): InventoryTotals => ({
  quantity: 100,
  onhand: 100,
  onHandSellable: 90,
  onHandReserved: 0,
  inTransitUnreserved: 0,
  inTransitReserved: 0,
  damagedOnHand: 10,
  availableStock: 90,
  supplierShortQty: 0,
  totalSales: 0,
  cogs: 0,
  netProfit: 0,
  endingInventoryValue: 0,
});

const createProduct = (productCode: string): ProductFromAPI => ({
  id: '1',
  'Product Code': productCode,
  Quantity: 100,
  COGS: 0,
  'Actual Price': 0,
  'Shipment Code': null,
  'Shipment Status': null,
});

const renderInventoryPage = () =>
  render(
    <MantineProvider>
      <InventoryPage />
    </MantineProvider>
  );

describe('InventoryPage adjustments tab', () => {
  const productCode = 'Premium Footed Pants (PFP-012426)';
  const updateMovementMock = vi.fn();

  beforeEach(() => {
    updateMovementMock.mockReset();

    const item = createInventoryItem(productCode);
    const totals = createTotals();

    const movements: InventoryMovementFromAPI[] = [
      {
        id: 101,
        productCode,
        quantity: 10,
        fromBucket: 'sellable',
        toBucket: 'damaged_hold',
        postingDate: '2026-02-17',
        notes: 'existing note',
      },
    ];

    mockUseInventoryPage.mockReturnValue({
      setSearchQuery: vi.fn(),
      isImporting: false,
      isLoading: false,
      isSubmittingMovement: false,
      headers: ['PRODUCT CODE', 'ACTUAL QUANTITY', 'SELLABLE', 'RESERVED'],
      totalItemCount: 1,
      filteredData: [item],
      totals,
      emptyStateMessage: 'No inventory records yet.',
      handleImportCSV: vi.fn(),
      handleExportCSV: vi.fn(),
      handleAddNew: vi.fn(),
      products: [createProduct(productCode)],
      movements,
      createMovement: vi.fn(),
      updateMovement: updateMovementMock,
      deleteMovement: vi.fn(),
      getSellableOnHand: vi.fn().mockReturnValue(90),
    });
  });

  it('does not render Actions column in adjustments table', () => {
    renderInventoryPage();

    fireEvent.click(screen.getByRole('tab', { name: /adjustments/i }));

    expect(screen.queryByText('ACTIONS')).not.toBeInTheDocument();
  });

  it('opens ADJUSTMENTS modal on double-clicking product code', () => {
    renderInventoryPage();

    fireEvent.click(screen.getByRole('tab', { name: /adjustments/i }));
    fireEvent.doubleClick(screen.getByText(productCode));

    expect(
      screen.getByRole('dialog', { name: 'ADJUSTMENTS' })
    ).toBeInTheDocument();
    expect(screen.getByText('ADJUSTMENTS')).toBeInTheDocument();
  });

  it('saves note-only update when target quantity is unchanged', () => {
    renderInventoryPage();

    fireEvent.click(screen.getByRole('tab', { name: /adjustments/i }));
    fireEvent.doubleClick(screen.getByText(productCode));

    const notesField = screen.getByLabelText('Notes');
    fireEvent.change(notesField, { target: { value: 'TEST note' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save Adjustment' }));

    expect(updateMovementMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 101,
        notes: 'TEST note',
      })
    );
  });
});
