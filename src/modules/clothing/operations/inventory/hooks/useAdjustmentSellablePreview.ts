import { useMemo } from 'react';
import { normalizeProductCode } from '@/lib/inventory/movements';

type AdjustmentBucket =
  | 'damaged_hold'
  | 'scrap'
  | 'supplier_short'
  | 'additionals';

interface UseAdjustmentSellablePreviewParams {
  selectedProduct: string;
  selectedOnHand: number;
  transferToProduct: string;
  transferQty: number | '';
  bucketQuantities: Record<AdjustmentBucket, number | ''>;
  getCurrentBucketQuantity: (
    productCode: string,
    bucket: AdjustmentBucket
  ) => number;
  getCurrentTransferQuantity: (
    fromProductCode: string,
    toProductCode: string
  ) => number;
}

export function useAdjustmentSellablePreview({
  selectedProduct,
  selectedOnHand,
  transferToProduct,
  transferQty,
  bucketQuantities,
  getCurrentBucketQuantity,
  getCurrentTransferQuantity,
}: UseAdjustmentSellablePreviewParams) {
  return useMemo(() => {
    if (!selectedProduct) {
      return {
        currentByBucket: {
          damaged_hold: 0,
          scrap: 0,
          supplier_short: 0,
          additionals: 0,
        } as Record<AdjustmentBucket, number>,
        targetByBucket: {
          damaged_hold: 0,
          scrap: 0,
          supplier_short: 0,
          additionals: 0,
        } as Record<AdjustmentBucket, number>,
        deltaByBucket: {
          damaged_hold: 0,
          scrap: 0,
          supplier_short: 0,
          additionals: 0,
        } as Record<AdjustmentBucket, number>,
        plannedSellableIn: 0,
        plannedSellableOut: 0,
        currentTransferQuantity: 0,
        targetTransferQuantity: 0,
        transferDelta: 0,
        plannedTransferIn: 0,
        plannedTransferOut: 0,
        projectedSellableOnHand: 0,
      };
    }

    const currentByBucket: Record<AdjustmentBucket, number> = {
      damaged_hold: getCurrentBucketQuantity(selectedProduct, 'damaged_hold'),
      scrap: getCurrentBucketQuantity(selectedProduct, 'scrap'),
      supplier_short: getCurrentBucketQuantity(
        selectedProduct,
        'supplier_short'
      ),
      additionals: getCurrentBucketQuantity(selectedProduct, 'additionals'),
    };

    const targetByBucket: Record<AdjustmentBucket, number> = {
      damaged_hold: Math.max(0, Number(bucketQuantities.damaged_hold || 0)),
      scrap: Math.max(0, Number(bucketQuantities.scrap || 0)),
      supplier_short: Math.max(0, Number(bucketQuantities.supplier_short || 0)),
      additionals: Math.max(0, Number(bucketQuantities.additionals || 0)),
    };

    const deltaByBucket: Record<AdjustmentBucket, number> = {
      damaged_hold: targetByBucket.damaged_hold - currentByBucket.damaged_hold,
      scrap: targetByBucket.scrap - currentByBucket.scrap,
      supplier_short:
        targetByBucket.supplier_short - currentByBucket.supplier_short,
      additionals: targetByBucket.additionals - currentByBucket.additionals,
    };

    const plannedSellableIn =
      Math.max(-deltaByBucket.damaged_hold, 0) +
      Math.max(-deltaByBucket.scrap, 0) +
      Math.max(-deltaByBucket.supplier_short, 0) +
      Math.max(deltaByBucket.additionals, 0);

    const plannedSellableOut =
      Math.max(deltaByBucket.damaged_hold, 0) +
      Math.max(deltaByBucket.scrap, 0) +
      Math.max(deltaByBucket.supplier_short, 0) +
      Math.max(-deltaByBucket.additionals, 0);

    const normalizedSourceProductCode = normalizeProductCode(selectedProduct);
    const normalizedTransferDestinationCode =
      normalizeProductCode(transferToProduct);
    const currentTransferQuantity =
      normalizedSourceProductCode && normalizedTransferDestinationCode
        ? getCurrentTransferQuantity(
            normalizedSourceProductCode,
            normalizedTransferDestinationCode
          )
        : 0;
    const targetTransferQuantity = Math.max(0, Number(transferQty || 0));
    const transferDelta = targetTransferQuantity - currentTransferQuantity;
    const plannedTransferOut = Math.max(transferDelta, 0);
    const plannedTransferIn = Math.max(-transferDelta, 0);

    return {
      currentByBucket,
      targetByBucket,
      deltaByBucket,
      plannedSellableIn,
      plannedSellableOut,
      currentTransferQuantity,
      targetTransferQuantity,
      transferDelta,
      plannedTransferIn,
      plannedTransferOut,
      projectedSellableOnHand:
        selectedOnHand +
        plannedSellableIn +
        plannedTransferIn -
        plannedSellableOut -
        plannedTransferOut,
    };
  }, [
    bucketQuantities,
    getCurrentBucketQuantity,
    getCurrentTransferQuantity,
    selectedOnHand,
    selectedProduct,
    transferToProduct,
    transferQty,
  ]);
}
