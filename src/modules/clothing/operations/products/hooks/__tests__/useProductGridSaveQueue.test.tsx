import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useProductGridSaveQueue } from '../useProductGridSaveQueue';
import type { ProductData } from '../../types/product.types';

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<Value>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const row = (id: number, name = 'Original') =>
  ({ id, Product: name, 'Product Code': `P-${id}` }) as ProductData;
const accepted = { skippedDetails: [] };

function requireProduct(product: ProductData | undefined): ProductData {
  if (!product) {
    throw new Error('Missing test product');
  }
  return product;
}

describe('product grid save queue', () => {
  it('retains ten separate one-cell pastes across different product rows', async () => {
    const first = deferred<typeof accepted>();
    const products = Array.from({ length: 10 }, (_, index) => row(index + 1));
    const save = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(accepted);
    const refresh = vi.fn().mockResolvedValue(products);
    const { result } = renderHook(() =>
      useProductGridSaveQueue({ products, save, refresh })
    );
    act(() => {
      products.forEach((product) =>
        result.current.enqueue([
          { ...product, Product: `Pasted ${product.id}` },
        ])
      );
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(
      result.current.products.every(
        (product) => product.Product === `Pasted ${product.id}`
      )
    ).toBe(true);
    await act(async () => {
      first.resolve(accepted);
    });
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[0][0]).toHaveLength(1);
    expect(save.mock.calls[1][0]).toHaveLength(9);
    expect(
      save.mock.calls[1][0].map((product: ProductData) => product.id)
    ).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(result.current.hasPendingChanges).toBe(false);
  });

  it('does not replace table data when only save status changes', async () => {
    const first = deferred<typeof accepted>();
    const save = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(accepted);
    const products = [row(1)];
    const refresh = vi.fn().mockRejectedValue(new Error('Read failed'));
    const { result } = renderHook(() =>
      useProductGridSaveQueue({ products, save, refresh })
    );
    act(() => {
      result.current.enqueue([row(1, 'Draft')]);
    });
    const draftData = result.current.products;
    await act(async () => {
      first.resolve(accepted);
    });
    expect(result.current.products).toBe(draftData);
  });

  it('does not discard newer edits made during the discard refresh', async () => {
    const read = deferred<ProductData[]>();
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValue(accepted);
    const refresh = vi
      .fn()
      .mockReturnValueOnce(read.promise)
      .mockResolvedValue([row(1)]);
    const { result } = renderHook(() =>
      useProductGridSaveQueue({ products: [row(1)], save, refresh })
    );
    await act(async () => {
      result.current.enqueue([row(1, 'Discard this')]);
    });
    let discard!: Promise<void>;
    act(() => {
      discard = result.current.discard();
    });
    act(() => {
      result.current.enqueue([row(1, 'Keep this')]);
    });
    await act(async () => {
      read.resolve([row(1)]);
      await discard;
    });
    expect(save.mock.calls[1][0]).toEqual([row(1, 'Keep this')]);
  });

  it.each([undefined, '/api/general-merchandise'])(
    'retains ten rapid edits and serializes changed rows in %s',
    async (scope) => {
      const first = deferred<typeof accepted>();
      const save = vi
        .fn()
        .mockReturnValueOnce(first.promise)
        .mockResolvedValue(accepted);
      const refresh = vi.fn().mockResolvedValue([row(1, '10'), row(2)]);
      const { result } = renderHook(() =>
        useProductGridSaveQueue({
          products: [row(1), row(2)],
          save,
          refresh,
          scope,
        })
      );

      act(() => {
        for (let index = 1; index <= 10; index++) {
          const current = requireProduct(result.current.getProduct(1));
          result.current.enqueue([{ ...current, Product: String(index) }]);
        }
      });
      expect(save).toHaveBeenCalledTimes(1);
      expect(save.mock.calls[0][0]).toEqual([row(1, '1')]);
      expect(result.current.products[0].Product).toBe('10');
      expect(refresh).not.toHaveBeenCalled();
      await act(async () => {
        first.resolve(accepted);
      });
      await waitFor(() => expect(result.current.hasPendingChanges).toBe(false));
      expect(save).toHaveBeenCalledTimes(2);
      expect(save.mock.calls[1][0]).toEqual([row(1, '10')]);
      expect(refresh).toHaveBeenCalledTimes(1);
    }
  );

  it('merges different cells before rerender and overlays stale query data', async () => {
    const first = deferred<typeof accepted>();
    const save = vi
      .fn()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue(accepted);
    const refresh = vi.fn().mockResolvedValue([row(1)]);
    const { result, rerender } = renderHook(
      ({ products }) => useProductGridSaveQueue({ products, save, refresh }),
      { initialProps: { products: [row(1)] } }
    );
    act(() => {
      result.current.enqueue([
        { ...requireProduct(result.current.getProduct(1)), Product: 'New' },
      ]);
      result.current.enqueue([
        { ...requireProduct(result.current.getProduct(1)), Lalamove: 25 },
      ]);
    });
    rerender({ products: [row(1, 'Stale GET')] });
    expect(result.current.products[0]).toMatchObject({
      Product: 'New',
      Lalamove: 25,
    });
    await act(async () => {
      first.resolve(accepted);
    });
    expect(save.mock.calls[1][0][0]).toMatchObject({
      Product: 'New',
      Lalamove: 25,
    });
  });

  it('keeps edits made during reconciliation and refreshes again after their save', async () => {
    const read = deferred<ProductData[]>();
    const save = vi.fn().mockResolvedValue(accepted);
    const refresh = vi
      .fn()
      .mockReturnValueOnce(read.promise)
      .mockResolvedValue([row(1, 'Latest')]);
    const { result } = renderHook(() =>
      useProductGridSaveQueue({ products: [row(1)], save, refresh })
    );
    await act(async () => {
      result.current.enqueue([row(1, 'First')]);
    });
    act(() => {
      result.current.enqueue([row(1, 'Latest')]);
    });
    await act(async () => {
      read.resolve([row(1, 'First')]);
    });
    await waitFor(() => expect(result.current.hasPendingChanges).toBe(false));
    expect(save.mock.calls[1][0]).toEqual([row(1, 'Latest')]);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('retains failed drafts, pauses automatic saves and only retries explicitly after refresh', async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValue(accepted);
    const refresh = vi.fn().mockResolvedValue([row(1)]);
    const { result } = renderHook(() =>
      useProductGridSaveQueue({ products: [row(1)], save, refresh })
    );
    await act(async () => {
      result.current.enqueue([row(1, 'First')]);
    });
    act(() => {
      result.current.enqueue([row(1, 'Latest')]);
    });
    expect(result.current.error).toBe('Offline');
    expect(result.current.products[0].Product).toBe('Latest');
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () => {
      await result.current.retry();
    });
    expect(save.mock.calls[1][0]).toEqual([row(1, 'Latest')]);
    expect(result.current.hasPendingChanges).toBe(false);
  });

  it('does not resubmit acknowledged rows after partial success', async () => {
    const save = vi
      .fn()
      .mockResolvedValueOnce({
        skippedDetails: [{ index: 1, issues: { code: 'Required' } }],
      })
      .mockResolvedValue(accepted);
    const refresh = vi.fn().mockResolvedValue([row(1), row(2)]);
    const { result } = renderHook(() =>
      useProductGridSaveQueue({ products: [row(1), row(2)], save, refresh })
    );
    await act(async () => {
      result.current.enqueue([row(1, 'Saved'), row(2, 'Rejected')]);
    });
    expect(result.current.error).toContain('P-2');
    expect(result.current.hasPendingChanges).toBe(true);
    await act(async () => {
      await result.current.retry();
    });
    expect(save.mock.calls[1][0]).toEqual([row(2, 'Rejected')]);
  });

  it('retries a failed reconciliation without resubmitting accepted writes', async () => {
    const save = vi.fn().mockResolvedValue(accepted);
    const refresh = vi
      .fn()
      .mockRejectedValueOnce(new Error('Read failed'))
      .mockResolvedValue([row(1)]);
    const { result } = renderHook(() =>
      useProductGridSaveQueue({ products: [row(1)], save, refresh })
    );
    await act(async () => {
      result.current.enqueue([row(1, 'Saved')]);
    });
    expect(result.current.hasPendingChanges).toBe(true);
    await act(async () => {
      await result.current.retry();
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.current.hasPendingChanges).toBe(false);
  });

  it('never recreates a missing product on retry', async () => {
    const save = vi.fn().mockRejectedValue(new Error('Failed'));
    const refresh = vi.fn().mockResolvedValue([]);
    const { result } = renderHook(() =>
      useProductGridSaveQueue({ products: [row(1)], save, refresh })
    );
    await act(async () => {
      result.current.enqueue([row(1, 'Pending')]);
    });
    await act(async () => {
      await result.current.retry();
    });
    expect(result.current.error).toContain('no longer exists');
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('isolates drafts and late completions when API scope changes', async () => {
    const first = deferred<typeof accepted>();
    const save = vi.fn().mockReturnValue(first.promise);
    const refresh = vi.fn().mockResolvedValue([row(1)]);
    const { result, rerender } = renderHook(
      ({ scope }) =>
        useProductGridSaveQueue({ scope, products: [row(1)], save, refresh }),
      { initialProps: { scope: '/api' } }
    );
    act(() => {
      result.current.enqueue([row(1, 'Clothing')]);
    });
    rerender({ scope: '/api/general-merchandise' });
    await act(async () => {
      first.resolve(accepted);
    });
    expect(result.current.products[0].Product).toBe('Original');
    expect(result.current.hasPendingChanges).toBe(false);
    expect(refresh).not.toHaveBeenCalled();
  });
});
