import { useMemo } from 'react';
import type { InventoryItem } from '../types';

export type SellableFilter = 'all' | 'non_zero_sellable';

interface UseInventoryDisplayDataParams {
  filteredData: InventoryItem[];
  sellableFilter: SellableFilter;
  emptyStateMessage: string;
  searchQuery: string;
}

export function useInventoryDisplayData({
  filteredData,
  sellableFilter,
  emptyStateMessage,
  searchQuery,
}: UseInventoryDisplayDataParams) {
  const sellableFilteredData = useMemo(() => {
    if (sellableFilter !== 'non_zero_sellable') {
      return filteredData;
    }

    return filteredData.filter((item) => item.sellableOnHand !== 0);
  }, [filteredData, sellableFilter]);

  const sortedFilteredData = useMemo(() => {
    return [...sellableFilteredData].sort((a, b) => {
      const aId = Number(a.id);
      const bId = Number(b.id);

      if (!Number.isNaN(aId) && !Number.isNaN(bId)) {
        return bId - aId;
      }

      return b.productCode.localeCompare(a.productCode);
    });
  }, [sellableFilteredData]);

  const singleFilteredProductCode = useMemo(() => {
    const uniqueProductCodes = Array.from(
      new Set(
        sellableFilteredData
          .map((item) => item.productCode.trim())
          .filter((code) => code.length > 0)
      )
    );

    return uniqueProductCodes.length === 1 ? uniqueProductCodes[0] : null;
  }, [sellableFilteredData]);

  const inventoryEmptyStateMessage = useMemo(() => {
    if (sellableFilter !== 'non_zero_sellable') {
      return emptyStateMessage;
    }

    return searchQuery
      ? `No inventory records with non-zero sellable value match "${searchQuery}".`
      : 'No inventory records with non-zero sellable value.';
  }, [emptyStateMessage, searchQuery, sellableFilter]);

  return {
    sellableFilteredData,
    sortedFilteredData,
    singleFilteredProductCode,
    inventoryEmptyStateMessage,
  };
}
