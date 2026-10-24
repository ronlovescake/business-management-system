import { act, renderHook } from '@testing-library/react';
import { waitFor } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCheckoutLinksPage } from '@/modules/clothing/operations/checkout-links/hooks/useCheckoutLinksPage';
import { serializeCheckoutLinksCsv } from '@/modules/clothing/operations/checkout-links/lib/csv';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), showNotification: vi.fn() }));
vi.mock('@mantine/notifications', () => ({
  showNotification: mocks.showNotification,
}));
vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined, isFetching: false }),
}));
vi.mock(
  '@/modules/clothing/operations/checkout-links/hooks/useInvoiceCustomerLookup',
  () => ({
    useInvoiceCustomerLookup: () => ({
      lookupFacebookLink: () => '',
      hasFacebookLink: () => false,
    }),
  })
);
vi.mock('@/lib/alerts', () => ({
  getSwal: async () => ({
    fire: async () => ({ isConfirmed: true, value: 'DELETE' }),
  }),
}));

const existing = {
  id: 'db-existing',
  weight: '1',
  width: '2',
  length: '3',
  height: '4',
  checkoutLinks: '',
  productPortals: '',
  productNames: 'Existing',
};
const imported = { ...existing, id: 'db-canonical', productNames: 'Imported' };
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const csvFile = () =>
  new File([serializeCheckoutLinksCsv([imported])], 'checkout.csv', {
    type: 'text/csv',
  });

describe('checkout import persistence', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('fetch', mocks.fetch);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps prior rows while saving and edits/deletes canonical IDs immediately after import', async () => {
    let finishPost!: (value: Response) => void;
    const posting = new Promise<Response>((resolve) => {
      finishPost = resolve;
    });
    let reads = 0;
    mocks.fetch.mockImplementation(
      async (url: string, options?: RequestInit) => {
        if (url.endsWith('/checkout-links') && options?.method === 'POST') {
          return posting;
        }
        if (url.endsWith('/checkout-links') && options?.method === 'PUT') {
          return response({ success: true, data: imported });
        }
        if (options?.method === 'DELETE') {
          return response({ success: true });
        }
        if (url.endsWith('/checkout-links')) {
          reads += 1;
          return response({
            success: true,
            data: reads === 1 ? [existing] : [existing, imported],
          });
        }
        return response({ success: true, data: [] });
      }
    );
    const { result } = renderHook(() => useCheckoutLinksPage());
    await waitFor(() =>
      expect(result.current.checkoutLinksState.isLoading).toBe(false)
    );
    act(() => result.current.checkoutLinksState.handleImportCSV(csvFile()));
    await waitFor(() =>
      expect(
        mocks.fetch.mock.calls.some(([, options]) => options?.method === 'POST')
      ).toBe(true)
    );
    expect(result.current.checkoutLinksState.data).toEqual([existing]);
    await act(async () =>
      finishPost(response({ success: true, data: { count: 1 } }))
    );
    await waitFor(() =>
      expect(result.current.checkoutLinksState.data).toEqual([
        existing,
        imported,
      ])
    );
    act(() =>
      result.current.checkoutLinksState.handleEdit(
        result.current.checkoutLinksState.data[1]
      )
    );
    await act(async () =>
      result.current.modalState.handleUpdateCheckoutLink(imported)
    );
    expect(mocks.fetch).toHaveBeenCalledWith(
      '/api/checkout-links',
      expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('"id":"db-canonical"'),
      })
    );
    await act(async () =>
      result.current.checkoutLinksState.handleDelete(imported)
    );
    expect(mocks.fetch).toHaveBeenCalledWith(
      '/api/checkout-links?id=db-canonical',
      { method: 'DELETE' }
    );
  });

  it.each([false, true])(
    'preserves the prior list when save/refresh fails (saved=%s)',
    async (saved) => {
      let reads = 0;
      mocks.fetch.mockImplementation(
        async (url: string, options?: RequestInit) => {
          if (options?.method === 'POST') {
            return response(
              { success: saved, error: 'Save failed' },
              saved ? 200 : 500
            );
          }
          if (url.endsWith('/checkout-links')) {
            reads += 1;
            return reads === 1
              ? response({ success: true, data: [existing] })
              : response({ success: false, error: 'Refresh failed' }, 500);
          }
          return response({ success: true, data: [] });
        }
      );
      const { result } = renderHook(() => useCheckoutLinksPage());
      await waitFor(() =>
        expect(result.current.checkoutLinksState.isLoading).toBe(false)
      );
      act(() => result.current.checkoutLinksState.handleImportCSV(csvFile()));
      await waitFor(() =>
        expect(mocks.showNotification).toHaveBeenCalledWith(
          expect.objectContaining({
            title: saved ? 'Import saved, refresh failed' : 'Import Failed',
          })
        )
      );
      expect(result.current.checkoutLinksState.data).toEqual([existing]);
      expect(result.current.checkoutLinksState.isImporting).toBe(false);
    }
  );
});
