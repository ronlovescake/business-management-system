import type { InventoryBucket } from '@/modules/clothing/operations/inventory/types';

export type MovementLike = {
  productCode: string | null | undefined;
  quantity: number | null | undefined;
  fromBucket: InventoryBucket;
  toBucket: InventoryBucket;
};

export function normalizeProductCode(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

export function buildSellableDeltaMap(movements: MovementLike[]) {
  const deltas = new Map<string, number>();

  movements.forEach((movement) => {
    const code = normalizeProductCode(movement.productCode);
    if (!code || !Number.isFinite(movement.quantity)) {
      return;
    }

    const qty = movement.quantity ?? 0;
    const fromSellable = movement.fromBucket === 'sellable';
    const toSellable = movement.toBucket === 'sellable';
    const current = deltas.get(code) ?? 0;
    deltas.set(
      code,
      current + (toSellable ? qty : 0) - (fromSellable ? qty : 0)
    );
  });

  return deltas;
}

export function getSellableOnHand(params: {
  productCode: string | null | undefined;
  sellableDeltaByProduct: Map<string, number>;
  fallbackQuantity?: number;
}) {
  const { productCode, sellableDeltaByProduct, fallbackQuantity = 0 } = params;
  const normalizedCode = normalizeProductCode(productCode);

  if (!normalizedCode) {
    return 0;
  }

  if (sellableDeltaByProduct.has(normalizedCode)) {
    return sellableDeltaByProduct.get(normalizedCode) ?? 0;
  }

  return fallbackQuantity;
}
