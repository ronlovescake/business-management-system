import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useProductsGrid } from '../useProductsGrid';
import { ProductService } from '../../services/ProductService';
import { PRODUCT_COLUMN_KEYS } from '../../lib/gridRenderers';
import type { ProductData } from '../../types/product.types';

vi.mock('@mantine/notifications', () => ({ showNotification: vi.fn() }));
vi.mock('@/lib/alerts', () => ({ showCustomAlert: vi.fn() }));

function setup(scope?: string) {
  const base = ProductService.formToProductData(
    ProductService.createEmptyForm(),
    false
  );
  let canonical: ProductData[] = [
    {
      ...base,
      id: 1,
      Product: 'First',
      'Product Code': 'P-1',
      'Shipment Code': 'SHIP-1',
      'CV Number': 'CV-1',
      Quantity: 10,
      'Unit Price': 2,
      'Exchange Rates': 1,
      'Transaction Fee': 0,
    },
    { ...base, id: 2, Product: 'Second', 'Product Code': 'P-2' },
  ];
  const load = vi
    .spyOn(ProductService, 'loadProducts')
    .mockImplementation(async () =>
      canonical.map((product) => ({ ...product }))
    );
  const save = vi
    .spyOn(ProductService, 'bulkUpdateProducts')
    .mockImplementation(async (rows) => {
      canonical = canonical.map(
        (product) => rows.find((update) => update.id === product.id) ?? product
      );
      return { skippedDetails: [] };
    });
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const result = {
    current: undefined as unknown as ReturnType<typeof useProductsGrid>,
  };
  function Probe() {
    result.current = useProductsGrid({ apiBasePath: scope });
    return null;
  }
  render(
    <QueryClientProvider client={client}>
      <Probe />
    </QueryClientProvider>
  );
  return { result, save, load, client };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('product grid inline saves', () => {
  it.each([undefined, '/api/general-merchandise'])(
    'preserves rapid one-cell pastes through a delayed save and canonical refresh in %s',
    async (scope) => {
      const { result, save, load } = setup(scope);
      await waitFor(() => expect(result.current.products).toHaveLength(2));
      const persist = save.getMockImplementation();
      if (!persist) {
        throw new Error('Missing test persistence handler');
      }
      let finish!: () => void;
      const delay = new Promise<void>((resolve) => {
        finish = resolve;
      });
      save.mockImplementationOnce(async (rows, apiScope) => {
        await delay;
        return persist(rows, apiScope);
      });
      const productColumn = PRODUCT_COLUMN_KEYS.indexOf('Product');
      const lalamoveColumn = PRODUCT_COLUMN_KEYS.indexOf('Lalamove');

      act(() => {
        for (let index = 1; index <= 10; index++) {
          result.current.handleAfterChange(
            [[0, productColumn, 'First', `Paste ${index}`]],
            'CopyPaste.paste'
          );
        }
        result.current.handleAfterChange(
          [[0, lalamoveColumn, 0, 50]],
          'CopyPaste.paste'
        );
      });
      expect(result.current.products[0]).toMatchObject({
        Product: 'Paste 10',
        Lalamove: 50,
      });
      await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
      expect(save.mock.calls[0][0]).toHaveLength(1);
      expect(save.mock.calls[0][0][0].Product).toBe('Paste 1');
      expect(load).toHaveBeenCalledTimes(1);
      await act(async () => {
        finish();
      });
      await waitFor(() =>
        expect(result.current.saveQueue.hasPendingChanges).toBe(false)
      );
      expect(save).toHaveBeenCalledTimes(2);
      expect(save.mock.calls[1][0][0]).toMatchObject({
        id: 1,
        Product: 'Paste 10',
        Lalamove: 50,
        COGS: 70,
        'Transaction Fee': 0,
      });
      expect(result.current.products[0].Product).toBe('Paste 10');
      expect(save.mock.calls[1][1]).toBe(scope);
      expect(load).toHaveBeenLastCalledWith(scope, { throwOnError: true });
    }
  );

  it('maps searched rows by stable ID and ignores loadData, spare rows and no-op changes', async () => {
    const { result, save } = setup();
    await waitFor(() => expect(result.current.products).toHaveLength(2));
    act(() => {
      result.current.handleSearch('P-2');
    });
    await waitFor(() =>
      expect(result.current.filteredProducts).toHaveLength(1)
    );
    const column = PRODUCT_COLUMN_KEYS.indexOf('Product');
    await act(async () => {
      result.current.handleAfterChange(
        [[0, column, 'Second', 'Ignored']],
        'loadData'
      );
      result.current.handleAfterChange(
        [[1, column, '', 'Spare']],
        'CopyPaste.paste'
      );
      result.current.handleAfterChange(
        [[-1, column, '', 'Negative']],
        'CopyPaste.paste'
      );
      result.current.handleAfterChange(
        [[0, column, 'Second', 'Second']],
        'CopyPaste.paste'
      );
    });
    expect(save).not.toHaveBeenCalled();
    await act(async () => {
      result.current.handleAfterChange(
        [[0, column, 'Second', 'Updated second']],
        'CopyPaste.paste'
      );
    });
    await waitFor(() =>
      expect(result.current.saveQueue.hasPendingChanges).toBe(false)
    );
    expect(save.mock.calls[0][0]).toEqual([
      expect.objectContaining({ id: 2, Product: 'Updated second' }),
    ]);
  });

  it('preserves shipment clearing and blocks modal writes during unresolved saves', async () => {
    const { result, save } = setup();
    await waitFor(() => expect(result.current.products).toHaveLength(2));
    save.mockRejectedValueOnce(new Error('Network unavailable'));
    await act(async () => {
      result.current.handleAfterChange(
        [[0, 0, 'SHIP-1', '']],
        'CopyPaste.paste'
      );
    });
    expect(result.current.products[0]).toMatchObject({
      'Shipment Code': '',
      'CV Number': '',
      'No. Of Sacks': 0,
      'Total CBM': 0,
      Weight: 0,
      'Shipment Status': '',
    });
    expect(result.current.saveQueue.error).toBe('Network unavailable');
    act(() => {
      result.current.openCreateProductModal();
    });
    expect(result.current.addProductOpen).toBe(false);
    await act(async () => {
      await result.current.saveQueue.retry();
    });
    expect(result.current.saveQueue.hasPendingChanges).toBe(false);
    act(() => {
      result.current.openCreateProductModal();
    });
    expect(result.current.addProductOpen).toBe(true);
  });
});
