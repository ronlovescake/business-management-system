import { useMemo } from 'react';
import { calculateTotals } from '../lib/inventoryTransforms';
import type {
  InventoryItem,
  InventoryMovementFromAPI,
  ProductFromAPI,
} from '../types';
import { useAdjustmentBuckets } from './useAdjustmentBuckets';
import { useAdjustmentSellablePreview } from './useAdjustmentSellablePreview';
import {
  useInventoryDisplayData,
  type SellableFilter,
} from './useInventoryDisplayData';
import { useInventoryMovementDerivedData } from './useInventoryMovementDerivedData';
import { useInventoryProductOptions } from './useInventoryProductOptions';
import { useTransferSummaries } from './useTransferSummaries';

type AdjustmentBucket =
  | 'damaged_hold'
  | 'scrap'
  | 'supplier_short'
  | 'additionals';

type UseInventoryViewModelParams = {
  filteredData: InventoryItem[];
  emptyStateMessage: string;
  searchQuery: string;
  sellableFilter: SellableFilter;
  products: ProductFromAPI[];
  movements: InventoryMovementFromAPI[] | undefined;
  selectedProduct: string;
  transferToProduct: string;
  transferQty: number | '';
  bucketQuantities: Record<AdjustmentBucket, number | ''>;
  editingProductCode: string | null;
  editingMovementId: number | null;
  additionalsNotePrefix: string;
  transferNotePrefix: string;
  transferNoteMarker: string;
  getSellableOnHand: (productCode: string) => number;
  normalizeProductCode: (value: string) => string;
};

export function useInventoryViewModel({
  filteredData,
  emptyStateMessage,
  searchQuery,
  sellableFilter,
  products,
  movements,
  selectedProduct,
  transferToProduct,
  transferQty,
  bucketQuantities,
  editingProductCode,
  editingMovementId,
  additionalsNotePrefix,
  transferNotePrefix,
  transferNoteMarker,
  getSellableOnHand,
  normalizeProductCode,
}: UseInventoryViewModelParams) {
  const selectedOnHand = useMemo(
    () => getSellableOnHand(selectedProduct),
    [getSellableOnHand, selectedProduct]
  );

  const movementData = useInventoryMovementDerivedData({
    movements,
    editingProductCode,
    editingMovementId,
    additionalsNotePrefix,
    transferNotePrefix,
  });

  const transferSummaries = useTransferSummaries({
    transferMovements: movementData.transferMovements,
    transferNoteMarker,
  });

  const adjustmentBuckets = useAdjustmentBuckets({
    filteredData,
    adjustmentMovements: movementData.adjustmentMovements,
    supplierShortMovements: movementData.supplierShortMovements,
    additionalsMovements: movementData.additionalsMovements,
    supplierShortQtyByProduct: movementData.supplierShortQtyByProduct,
    additionalsQtyByProduct: movementData.additionalsQtyByProduct,
  });

  const adjustmentSellablePreview = useAdjustmentSellablePreview({
    selectedProduct,
    selectedOnHand,
    transferToProduct,
    transferQty,
    bucketQuantities,
    getCurrentBucketQuantity: adjustmentBuckets.getCurrentBucketQuantity,
    getCurrentTransferQuantity: transferSummaries.getCurrentTransferQuantity,
  });

  const displayData = useInventoryDisplayData({
    filteredData,
    sellableFilter,
    emptyStateMessage,
    searchQuery,
  });

  const displayedTotals = useMemo(
    () => calculateTotals(displayData.sellableFilteredData),
    [displayData.sellableFilteredData]
  );

  const productOptions = useInventoryProductOptions({
    products,
    selectedProduct,
    normalizeProductCode,
  });

  return {
    ...movementData,
    ...transferSummaries,
    ...adjustmentBuckets,
    ...displayData,
    ...productOptions,
    selectedOnHand,
    adjustmentSellablePreview,
    displayedTotals,
  };
}
