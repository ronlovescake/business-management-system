import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSortingDistributionData } from '../useSortingDistributionData';
import { SortingDistributionService } from '../../services/SortingDistributionService';
import { AUTO_SAVE_DELAY } from '../../types/sortingDistribution.types';

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}

const loaded = (quantity: number) => ({
  rows: SortingDistributionService.calculateDerivedFields(
    SortingDistributionService.updateRowQuantity(
      SortingDistributionService.createDefaultRows(),
      0,
      quantity
    ),
    quantity,
    null
  ),
  selectedQuantity: null,
});
const saved = { success: true, savedCount: 1 };

async function advanceTime(milliseconds: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
}

describe('sorting load and autosave ownership', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(SortingDistributionService, 'loadProducts').mockResolvedValue({
      productOptions: [],
      allProducts: [],
    });
    vi.spyOn(SortingDistributionService, 'loadTransactions').mockResolvedValue(
      []
    );
    vi.spyOn(
      SortingDistributionService,
      'loadDistributionData'
    ).mockResolvedValue(loaded(10));
    vi.spyOn(
      SortingDistributionService,
      'saveDistributionData'
    ).mockResolvedValue(saved);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function mount() {
    const onSelectedQuantityChange = vi.fn();
    return {
      ...renderHook(
        ({ productCode }) =>
          useSortingDistributionData({
            productCode,
            selectedQuantity: null,
            onSelectedQuantityChange,
            includeAllProducts: false,
          }),
        { initialProps: { productCode: 'A' } }
      ),
      onSelectedQuantityChange,
    };
  }

  it('ignores an old product response after the new product finishes loading', async () => {
    const first = deferred<ReturnType<typeof loaded>>();
    const second = deferred<ReturnType<typeof loaded>>();
    vi.mocked(SortingDistributionService.loadDistributionData)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const { result, rerender, onSelectedQuantityChange } = mount();
    rerender({ productCode: 'B' });
    await act(async () => second.resolve(loaded(30)));
    expect(result.current.rows[0].quantity).toBe(30);
    await act(async () => first.resolve(loaded(10)));
    expect(result.current.rows[0].quantity).toBe(30);
    expect(onSelectedQuantityChange).toHaveBeenCalledTimes(1);
  });

  it('never saves old grid edits under a product that is still loading', async () => {
    const second = deferred<ReturnType<typeof loaded>>();
    vi.mocked(SortingDistributionService.loadDistributionData)
      .mockResolvedValueOnce(loaded(10))
      .mockReturnValueOnce(second.promise);
    const { result, rerender } = mount();
    await act(async () => {});
    act(() => result.current.updateRowQuantity(0, 20));
    rerender({ productCode: 'B' });
    await advanceTime(AUTO_SAVE_DELAY);
    expect(
      SortingDistributionService.saveDistributionData
    ).not.toHaveBeenCalled();
    await act(async () => second.resolve(loaded(30)));
    expect(result.current.rows[0].quantity).toBe(30);
  });

  it('finishes a failed load without allowing edits to overwrite unknown saved data', async () => {
    vi.mocked(
      SortingDistributionService.loadDistributionData
    ).mockRejectedValueOnce(new Error('Offline'));
    const { result } = mount();
    await act(async () => {});
    expect(result.current.isLoading).toBe(false);
    act(() => result.current.updateRowQuantity(0, 20));
    await advanceTime(AUTO_SAVE_DELAY);
    expect(
      SortingDistributionService.saveDistributionData
    ).not.toHaveBeenCalled();
  });

  it('does not let an old save cancel the new product debounce', async () => {
    const firstSave = deferred<typeof saved>();
    vi.mocked(
      SortingDistributionService.saveDistributionData
    ).mockReturnValueOnce(firstSave.promise);
    vi.mocked(SortingDistributionService.loadDistributionData)
      .mockResolvedValueOnce(loaded(10))
      .mockResolvedValueOnce(loaded(30));
    const { result, rerender } = mount();
    await act(async () => {});
    act(() => result.current.updateRowQuantity(0, 20));
    await advanceTime(AUTO_SAVE_DELAY);
    rerender({ productCode: 'B' });
    await act(async () => {});
    act(() => result.current.updateRowQuantity(0, 40));
    await advanceTime(AUTO_SAVE_DELAY / 2);
    await act(async () => firstSave.resolve(saved));
    await advanceTime(AUTO_SAVE_DELAY / 2);
    expect(
      SortingDistributionService.saveDistributionData
    ).toHaveBeenCalledTimes(2);
    expect(
      SortingDistributionService.saveDistributionData
    ).toHaveBeenLastCalledWith(
      'B',
      null,
      expect.arrayContaining([expect.objectContaining({ quantity: 40 })]),
      undefined
    );
  });

  it('serializes saves so an earlier request cannot overwrite a newer edit', async () => {
    const firstSave = deferred<typeof saved>();
    vi.mocked(
      SortingDistributionService.saveDistributionData
    ).mockReturnValueOnce(firstSave.promise);
    const { result } = mount();
    await act(async () => {});
    act(() => result.current.updateRowQuantity(0, 20));
    await advanceTime(AUTO_SAVE_DELAY);
    act(() => result.current.updateRowQuantity(0, 30));
    await advanceTime(AUTO_SAVE_DELAY);
    expect(
      SortingDistributionService.saveDistributionData
    ).toHaveBeenCalledTimes(1);
    await act(async () => firstSave.resolve(saved));
    expect(
      SortingDistributionService.saveDistributionData
    ).toHaveBeenCalledTimes(2);
    expect(
      SortingDistributionService.saveDistributionData
    ).toHaveBeenLastCalledWith(
      'A',
      null,
      expect.arrayContaining([expect.objectContaining({ quantity: 30 })]),
      undefined
    );
  });
});
