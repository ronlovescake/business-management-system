import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { fireEvent, screen, waitFor } from '@testing-library/dom';
import { MantineProvider } from '@mantine/core';
import { PricesPage } from '../PricesPage';
import type { PriceFormData } from '../../types/price.types';

const rows = [
  {
    'Product Code': 'A',
    'Lower Limit': 1,
    'Upper Limit': 9,
    Prices: 55,
    'Price Adjustment': 0,
  },
  {
    'Product Code': 'A',
    'Lower Limit': 10,
    'Upper Limit': 10000,
    Prices: 50,
    'Price Adjustment': 0,
  },
  {
    'Product Code': 'B',
    'Lower Limit': 1,
    'Upper Limit': 10000,
    Prices: 75,
    'Price Adjustment': 0,
  },
];
vi.mock('../../hooks/usePricesData', () => ({
  usePricesData: () => ({
    prices: rows,
    filteredPrices: rows,
    debouncedFilteredPrices: rows,
    searchQuery: '',
    handleSearch: vi.fn(),
    stats: {},
    isLoading: false,
    replaceAllPrices: vi.fn(),
    reloadPrices: vi.fn(),
  }),
}));
vi.mock('../../hooks/usePriceForm', () => ({
  usePriceForm: () => ({
    form: { productCode: '', tiers: [], priceAdjustment: 0 },
    productCodeOptions: [],
    fetchProductCodes: vi.fn(),
  }),
}));
vi.mock('@/components/layout/PageLayout', () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../PriceStatsCards', () => ({ PriceStatsCards: () => null }));
vi.mock('../AddPriceModal', () => ({ AddPriceModal: () => null }));
vi.mock('@glideapps/glide-data-grid', () => ({
  GridCellKind: { Text: 'text' },
  DataEditor: ({
    onCellClicked,
  }: {
    onCellClicked: (cell: number[]) => void;
  }) => (
    <>
      <button
        onClick={() => {
          onCellClicked([0, 0]);
          onCellClicked([0, 0]);
        }}
      >
        Open A
      </button>
      <button
        onClick={() => {
          onCellClicked([0, 2]);
          onCellClicked([0, 2]);
        }}
      >
        Open B
      </button>
    </>
  ),
}));
vi.mock('../EditPriceModal', () => ({
  EditPriceModal: ({
    opened,
    form,
    onTierChange,
    onClose,
  }: {
    opened: boolean;
    form: PriceFormData;
    onTierChange: (index: number, field: string, value: number) => void;
    onClose: () => void;
  }) =>
    opened ? (
      <>
        <output data-testid="code">{form.productCode}</output>
        <output data-testid="price">{form.tiers[0].price}</output>
        <output data-testid="upper-limit">{form.tiers[0].upperLimit}</output>
        <button onClick={() => onTierChange(1, 'lowerLimit', 0)}>
          Clear Tier
        </button>
        <button onClick={() => onTierChange(0, 'price', 999)}>Set Price</button>
        <button onClick={onClose}>Close Edit</button>
      </>
    ) : null,
}));

function deferredResponse() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}
const envelope = (data: unknown) =>
  new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

describe('price edit recalculation', () => {
  beforeEach(() => {
    vi.stubGlobal('React', React);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('clears a tier using real API envelopes and recalculates the remaining tier', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        envelope(
          url.endsWith('/products')
            ? [{ 'Product Code': 'A', 'Actual Price': 60 }]
            : []
        )
      )
    );
    render(
      <MantineProvider>
        <PricesPage />
      </MantineProvider>
    );
    fireEvent.click(screen.getByText('Open A'));
    await waitFor(() =>
      expect(screen.getByTestId('price')).toHaveTextContent('65')
    );
    fireEvent.click(screen.getByText('Clear Tier'));
    await waitFor(() =>
      expect(screen.getByTestId('price')).toHaveTextContent('60')
    );
    expect(screen.getByTestId('upper-limit')).toHaveTextContent('10000');
  });

  it('ignores an older product response after another product is opened', async () => {
    const first = deferredResponse();
    let productRequests = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (!url.endsWith('/products')) {
          return Promise.resolve(envelope([]));
        }
        productRequests += 1;
        return productRequests === 1
          ? first.promise
          : Promise.resolve(
              envelope([{ 'Product Code': 'B', 'Actual Price': 80 }])
            );
      })
    );
    render(
      <MantineProvider>
        <PricesPage />
      </MantineProvider>
    );
    fireEvent.click(screen.getByText('Open A'));
    fireEvent.click(screen.getByText('Open B'));
    await waitFor(() =>
      expect(screen.getByTestId('price')).toHaveTextContent('80')
    );
    await act(async () =>
      first.resolve(envelope([{ 'Product Code': 'A', 'Actual Price': 60 }]))
    );
    expect(screen.getByTestId('code')).toHaveTextContent('B');
    expect(screen.getByTestId('price')).toHaveTextContent('80');
  });

  it('does not overwrite an edit made while its request is pending', async () => {
    const response = deferredResponse();
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url.endsWith('/products')
          ? response.promise
          : Promise.resolve(envelope([]))
      )
    );
    render(
      <MantineProvider>
        <PricesPage />
      </MantineProvider>
    );
    fireEvent.click(screen.getByText('Open A'));
    fireEvent.click(screen.getByText('Set Price'));
    await act(async () =>
      response.resolve(envelope([{ 'Product Code': 'A', 'Actual Price': 60 }]))
    );
    expect(screen.getByTestId('price')).toHaveTextContent('999');
  });
});
