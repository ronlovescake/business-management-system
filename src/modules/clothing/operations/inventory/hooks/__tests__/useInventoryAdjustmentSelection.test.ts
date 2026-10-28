import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useInventoryAdjustmentSelection } from '../useInventoryAdjustmentSelection';

describe('inventory adjustment selection', () => {
  it('preserves an entered shortage across refreshed readers and reloads only on explicit selection', () => {
    const options: Parameters<typeof useInventoryAdjustmentSelection>[0] = {
      selectedProduct: 'PRODUCT-1',
      searchQuery: '',
      singleFilteredProductCode: 'PRODUCT-1',
      transferToProduct: '',
      getLatestBucketNote: () => '',
      getCurrentBucketQuantity: () => 0,
      getCurrentTransferQuantity: () => 0,
      normalizeProductCode: (value) => value.trim().toUpperCase(),
      transferOutByProduct: { destinationsBySource: new Map() },
      productOptionValueByNormalizedCode: new Map(),
      setSelectedProduct: vi.fn(),
      setSearchQuery: vi.fn(),
      setNotes: vi.fn(),
      setPostingDate: vi.fn(),
      setTransferToProduct: vi.fn(),
      setTransferQty: vi.fn(),
      setBucketQuantities: vi.fn(),
      openAdjustmentModal: vi.fn(),
    };
    const { result, rerender } = renderHook(
      ({ readQuantity }) => {
        const [buckets, setBuckets] = useState<
          Record<
            'damaged_hold' | 'scrap' | 'supplier_short' | 'additionals',
            number | ''
          >
        >({ damaged_hold: 0, scrap: 0, supplier_short: 0, additionals: 0 });
        const selection = useInventoryAdjustmentSelection({
          ...options,
          getCurrentBucketQuantity: readQuantity,
          setBucketQuantities: setBuckets,
        });
        return { ...selection, buckets, setBuckets };
      },
      { initialProps: { readQuantity: (): number => 0 } }
    );
    act(() => result.current.openAdjustmentModalFromFilter());
    act(() =>
      result.current.setBuckets({
        damaged_hold: 0,
        scrap: 0,
        supplier_short: 120,
        additionals: 0,
      })
    );
    rerender({ readQuantity: () => 7 });
    expect(result.current.buckets.supplier_short).toBe(120);
    act(() => result.current.handleAdjustmentProductChange('PRODUCT-2'));
    expect(result.current.buckets.supplier_short).toBe(7);
    act(() => result.current.handleAdjustmentProductChange(null));
    expect(result.current.buckets.supplier_short).toBe(0);
    act(() => result.current.openAdjustmentForProduct('PRODUCT-1'));
    expect(result.current.buckets.supplier_short).toBe(7);
  });
});
