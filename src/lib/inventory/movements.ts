import type { InventoryBucket } from '@/modules/clothing/operations/inventory/types';

export type MovementLike = {
  productCode: string | null | undefined;
  quantity: number | null | undefined;
  fromBucket: InventoryBucket;
  toBucket: InventoryBucket;
};

export function buildSellableReceiptCodeSet(
  movements: MovementLike[]
): Set<string> {
  const codes = new Set<string>();

  movements.forEach((movement) => {
    const code = normalizeProductCode(movement.productCode);
    if (!code || !Number.isFinite(movement.quantity)) {
      return;
    }

    // If we have any non-sellable -> sellable movement for a product, we treat
    // sellable deltas as a full ledger (absolute), not a delta on top of the
    // product's fallback quantity.
    if (
      movement.toBucket === 'sellable' &&
      movement.fromBucket !== 'sellable'
    ) {
      codes.add(code);
    }
  });

  return codes;
}

export function normalizeProductCode(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

export function buildBucketDeltaMap(
  movements: MovementLike[],
  bucket: InventoryBucket
) {
  const deltas = new Map<string, number>();

  movements.forEach((movement) => {
    const code = normalizeProductCode(movement.productCode);
    if (!code || !Number.isFinite(movement.quantity)) {
      return;
    }

    const qty = movement.quantity ?? 0;
    const fromBucket = movement.fromBucket === bucket;
    const toBucket = movement.toBucket === bucket;

    if (!fromBucket && !toBucket) {
      return;
    }

    const current = deltas.get(code) ?? 0;
    deltas.set(code, current + (toBucket ? qty : 0) - (fromBucket ? qty : 0));
  });

  return deltas;
}

export function buildSellableDeltaMap(movements: MovementLike[]) {
  return buildBucketDeltaMap(movements, 'sellable');
}

export function buildReservedDeltaMap(movements: MovementLike[]) {
  return buildBucketDeltaMap(movements, 'reserved');
}

export function getSellableOnHand(params: {
  productCode: string | null | undefined;
  sellableDeltaByProduct: Map<string, number>;
  fallbackQuantity?: number;
  sellableReceiptCodes?: Set<string>;
}) {
  const {
    productCode,
    sellableDeltaByProduct,
    fallbackQuantity = 0,
    sellableReceiptCodes,
  } = params;
  const normalizedCode = normalizeProductCode(productCode);

  if (!normalizedCode) {
    return 0;
  }

  if (sellableDeltaByProduct.has(normalizedCode)) {
    const delta = sellableDeltaByProduct.get(normalizedCode) ?? 0;
    const hasReceiptLedger = sellableReceiptCodes?.has(normalizedCode) ?? false;

    // If we have explicit receipts into sellable, treat deltas as absolute.
    if (hasReceiptLedger) {
      return delta;
    }

    // Otherwise, treat movements as adjustments to the product's baseline.
    return fallbackQuantity + delta;
  }

  return fallbackQuantity;
}
