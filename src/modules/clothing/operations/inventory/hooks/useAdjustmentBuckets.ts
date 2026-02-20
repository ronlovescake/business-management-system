import { useCallback, useMemo } from 'react';
import { normalizeProductCode } from '@/lib/inventory/movements';
import type { InventoryItem, InventoryMovementFromAPI } from '../types';

type AdjustmentBucket =
  | 'damaged_hold'
  | 'scrap'
  | 'supplier_short'
  | 'additionals';

interface UseAdjustmentBucketsParams {
  filteredData: InventoryItem[];
  adjustmentMovements: InventoryMovementFromAPI[];
  supplierShortMovements: InventoryMovementFromAPI[];
  additionalsMovements: InventoryMovementFromAPI[];
  supplierShortQtyByProduct: Map<string, number>;
  additionalsQtyByProduct: Map<string, number>;
}

export function useAdjustmentBuckets({
  filteredData,
  adjustmentMovements,
  supplierShortMovements,
  additionalsMovements,
  supplierShortQtyByProduct,
  additionalsQtyByProduct,
}: UseAdjustmentBucketsParams) {
  const adjustmentNotesByProduct = useMemo(() => {
    const map = new Map<string, string>();
    const relevantMovements = [
      ...adjustmentMovements,
      ...supplierShortMovements,
      ...additionalsMovements,
    ].sort((a, b) => Number(b.id) - Number(a.id));

    relevantMovements.forEach((movement) => {
      const code = normalizeProductCode(movement.productCode);
      const rawNote = (movement.notes ?? '').trim();
      const note = rawNote.replace(/^additionals(?:\s*:\s*)?/i, '').trim();
      if (!code || !note) {
        return;
      }

      const existing = map.get(code);
      if (!existing) {
        map.set(code, note);
        return;
      }

      if (!existing.toLowerCase().includes(note.toLowerCase())) {
        map.set(code, `${existing}; ${note}`);
      }
    });

    return map;
  }, [adjustmentMovements, supplierShortMovements, additionalsMovements]);

  const inventoryItemByCode = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    filteredData.forEach((item) => {
      const code = item.productCode.trim();
      if (!code) {
        return;
      }

      map.set(code, item);
    });
    return map;
  }, [filteredData]);

  const getCurrentBucketQuantity = useCallback(
    (productCode: string, bucket: AdjustmentBucket): number => {
      const code = productCode.trim();
      if (!code) {
        return 0;
      }

      if (bucket === 'supplier_short') {
        return supplierShortQtyByProduct.get(code) ?? 0;
      }

      if (bucket === 'additionals') {
        return additionalsQtyByProduct.get(code) ?? 0;
      }

      const item = inventoryItemByCode.get(code);
      if (!item) {
        return 0;
      }

      return bucket === 'damaged_hold' ? item.damagedOnHand : item.scrapQty;
    },
    [additionalsQtyByProduct, inventoryItemByCode, supplierShortQtyByProduct]
  );

  const getLatestBucketNote = useCallback(
    (
      productCode: string,
      bucket: 'damaged_hold' | 'scrap' | 'supplier_short' | 'additionals'
    ): string => {
      const normalizedCode = normalizeProductCode(productCode);
      if (!normalizedCode) {
        return '';
      }

      const movementForBucket =
        bucket === 'additionals'
          ? additionalsMovements.find(
              (movement) =>
                normalizeProductCode(movement.productCode) === normalizedCode
            )
          : bucket === 'supplier_short'
            ? supplierShortMovements.find(
                (movement) =>
                  normalizeProductCode(movement.productCode) ===
                    normalizedCode && movement.toBucket === 'supplier_short'
              )
            : adjustmentMovements.find(
                (movement) =>
                  normalizeProductCode(movement.productCode) ===
                    normalizedCode && movement.toBucket === bucket
              );

      const rawNote = (movementForBucket?.notes ?? '').trim();
      if (!rawNote) {
        return '';
      }

      return rawNote.replace(/^additionals(?:\s*:\s*)?/i, '').trim();
    },
    [additionalsMovements, adjustmentMovements, supplierShortMovements]
  );

  return {
    adjustmentNotesByProduct,
    getCurrentBucketQuantity,
    getLatestBucketNote,
  };
}
