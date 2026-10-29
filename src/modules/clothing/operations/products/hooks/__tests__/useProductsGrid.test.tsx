import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { showCustomAlert } from '@/lib/alerts';
import { api } from '@/lib/api/client';
import { useProductsGrid } from '../useProductsGrid';
import { ProductService } from '../../services/ProductService';
import { PRODUCT_COLUMN_KEYS } from '../../lib/gridRenderers';
import type { ProductData } from '../../types/product.types';

vi.mock('@mantine/notifications', () => ({ showNotification: vi.fn() }));
vi.mock('@/lib/alerts', () => ({ showCustomAlert: vi.fn() }));

function setup(
  scope?: string,
  firstProductOverrides: Partial<ProductData> = {}
) {
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
      ...firstProductOverrides,
    },
    {
      ...base,
      id: 2,
      Product: 'Second',
      'Product Code': 'P-2',
      Quantity: 20,
      'Grand Total': 200,
      COGS: 230,
      "Forwarder's Fee": 20,
      Lalamove: 4,
      'Packaging Cost': 6,
      'Projected Sales': 600,
      'Projected Profit': 370,
    },
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
    expect(result.current.statistics).toMatchObject({
      total: 1,
      totalValue: 600,
      avgValue: 600,
      totalProfit: 370,
      grandTotal: 200,
      cogs: 230,
      forwardersFee: 20,
      lalamove: 4,
      packagingCost: 6,
      totalQuantity: 20,
    });
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

describe('product grid transit funding', () => {
  const confirmed = (value?: string | number) => ({
    isConfirmed: true,
    isDenied: false,
    isDismissed: false,
    value,
  });
  const dismissed = {
    isConfirmed: false,
    isDenied: false,
    isDismissed: true,
  };

  async function selectedProduct(scope?: string) {
    const state = setup(scope, {
      Payment: 'Paid',
      'Order Date': '2026-09-01',
      'Posting Date': '2026-10-12',
      'Grand Total': 30636.64,
      "Forwarder's Fee": 1530,
      Lalamove: 950,
      'Packaging Cost': 1500,
    });
    await waitFor(() => expect(state.result.current.products).toHaveLength(2));
    act(() => {
      state.result.current.handleCellClick(new MouseEvent('click'), {
        row: 0,
        col: 0,
      });
    });
    vi.mocked(showCustomAlert).mockReset();
    return state;
  }

  it('previews and posts a confirmed supplier-only opening against Opening Equity', async () => {
    const { result } = await selectedProduct();
    const get = vi
      .spyOn(api, 'get')
      .mockResolvedValue({ cutoverDate: '2026-10-12T00:00:00.000Z' });
    const post = vi
      .spyOn(api, 'post')
      .mockResolvedValue({ created: 1, skipped: 0, products: 1 });
    vi.mocked(showCustomAlert)
      .mockResolvedValueOnce(confirmed('OPENING_BALANCE'))
      .mockResolvedValueOnce(confirmed(1));

    await act(async () => {
      await result.current.handleTransitBuildUp();
    });

    expect(get).toHaveBeenCalledWith('/api/accounting/opening-balance');
    expect(showCustomAlert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        input: 'radio',
        inputValue: 'PAYMENT',
        inputOptions: {
          PAYMENT: 'Purchase Payment',
          OPENING_BALANCE: 'Opening Balance',
        },
      })
    );
    const preview = vi.mocked(showCustomAlert).mock.calls[1][0];
    expect(preview.input).toBe('checkbox');
    expect(preview.html).toContain(
      'Dr Inventory in Transit / Cr Opening Equity'
    );
    expect(preview.html).toContain('2026-10-12');
    expect(preview.html).toContain('30,636.64');
    expect(preview.html).toContain("Forwarder's Fee (excluded)");
    expect(preview.html).toContain('Lalamove (excluded)');
    expect(preview.html).not.toContain('33,116.64');
    if (preview.input !== 'checkbox') {
      throw new Error('Missing opening confirmation checkbox');
    }
    expect(preview.inputValidator?.('0')).toBe('Confirmation is required.');
    expect(preview.inputValidator?.('1')).toBeUndefined();
    expect(post).toHaveBeenCalledWith('/api/products/transit-build', {
      shipmentCode: 'SHIP-1',
      fundingSource: 'OPENING_BALANCE',
      openingBalanceConfirmed: true,
    });
  });

  it.each([dismissed, confirmed(0)])(
    'does not post a cancelled or unconfirmed opening: %j',
    async (outcome) => {
      const { result } = await selectedProduct();
      vi.spyOn(api, 'get').mockResolvedValue({ cutoverDate: '2026-10-12' });
      const post = vi.spyOn(api, 'post');
      vi.mocked(showCustomAlert)
        .mockResolvedValueOnce(confirmed('OPENING_BALANCE'))
        .mockResolvedValueOnce(outcome);
      await act(async () => {
        await result.current.handleTransitBuildUp();
      });
      expect(post).not.toHaveBeenCalled();
    }
  );

  it('does not post when the funding choice is cancelled', async () => {
    const { result } = await selectedProduct();
    const post = vi.spyOn(api, 'post');
    vi.mocked(showCustomAlert).mockResolvedValueOnce(dismissed);
    await act(async () => {
      await result.current.handleTransitBuildUp();
    });
    expect(post).not.toHaveBeenCalled();
  });

  it('fails closed when the cutover date is unavailable', async () => {
    const { result } = await selectedProduct();
    vi.spyOn(api, 'get').mockResolvedValue({ entries: [] });
    const post = vi.spyOn(api, 'post');
    vi.mocked(showCustomAlert).mockResolvedValueOnce(
      confirmed('OPENING_BALANCE')
    );
    await act(async () => {
      await result.current.handleTransitBuildUp();
    });
    expect(showCustomAlert).toHaveBeenCalledTimes(1);
    expect(post).not.toHaveBeenCalled();
  });

  it('retains the purchase-funded request without opening confirmation', async () => {
    const { result } = await selectedProduct();
    const post = vi
      .spyOn(api, 'post')
      .mockResolvedValue({ created: 1, skipped: 0, products: 1 });
    vi.mocked(showCustomAlert)
      .mockResolvedValueOnce(confirmed('PAYMENT'))
      .mockResolvedValueOnce(confirmed());
    await act(async () => {
      await result.current.handleTransitBuildUp();
    });
    expect(post).toHaveBeenCalledWith('/api/products/transit-build', {
      shipmentCode: 'SHIP-1',
    });
  });

  it('keeps General Merchandise on its original purchase-funded dialog', async () => {
    const { result } = await selectedProduct('/api/general-merchandise');
    const post = vi
      .spyOn(api, 'post')
      .mockResolvedValue({ created: 1, skipped: 0, products: 1 });
    vi.mocked(showCustomAlert).mockResolvedValueOnce(confirmed());
    await act(async () => {
      await result.current.handleTransitBuildUp();
    });
    expect(showCustomAlert).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(showCustomAlert).mock.calls[0][0].inputOptions
    ).toBeUndefined();
    expect(post).toHaveBeenCalledWith(
      '/api/general-merchandise/products/transit-build',
      { shipmentCode: 'SHIP-1' }
    );
  });

  it('rejects a direct opening-funded request through the shared General Merchandise client', async () => {
    const post = vi.spyOn(api, 'post');
    const result = await ProductService.postTransitBuildUpByShipmentCode(
      'SHIP-1',
      '/api/general-merchandise',
      {
        fundingSource: 'OPENING_BALANCE',
        openingBalanceConfirmed: true,
      }
    );
    expect(result.success).toBe(false);
    expect(post).not.toHaveBeenCalled();
  });
});
