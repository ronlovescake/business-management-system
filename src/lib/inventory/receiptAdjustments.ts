import {
  buildSellableDeltaMap,
  normalizeProductCode,
  type MovementLike,
} from '@/lib/inventory/movements';

export type ReceiptAdjustmentDirection =
  | {
      fromBucket: 'scrap';
      toBucket: 'sellable';
      quantity: number;
    }
  | {
      fromBucket: 'sellable';
      toBucket: 'scrap' | 'damaged_hold';
      quantity: number;
    };

export type ComputeSellableReceiptAdjustmentParams = {
  productCode: string | null | undefined;
  targetSellableOnHand: number;
  movements: MovementLike[];
  negativeToBucket?: 'scrap' | 'damaged_hold';
  tolerance?: number;
};

export type ComputeSellableReceiptAdjustmentResult = {
  normalizedProductCode: string;
  currentSellableOnHand: number;
  targetSellableOnHand: number;
  delta: number;
  action: 'noop' | 'create_movement';
  movement?: ReceiptAdjustmentDirection;
};

export function buildAutoReceiptAdjustmentNote(params: {
  productId?: number | null;
  targetSellableOnHand: number;
}) {
  const idPart = params.productId ? String(params.productId) : 'unknown';
  return `auto-receipt-adjust product ${idPart} target ${params.targetSellableOnHand}`;
}

export function computeSellableReceiptAdjustment(
  params: ComputeSellableReceiptAdjustmentParams
): ComputeSellableReceiptAdjustmentResult {
  const {
    productCode,
    targetSellableOnHand,
    movements,
    negativeToBucket = 'scrap',
    tolerance = 1e-9,
  } = params;

  const normalizedProductCode = normalizeProductCode(productCode);
  if (!normalizedProductCode) {
    throw new Error('productCode is required');
  }

  if (!Number.isFinite(targetSellableOnHand) || targetSellableOnHand < 0) {
    throw new Error(
      'targetSellableOnHand must be a finite non-negative number'
    );
  }

  const deltas = buildSellableDeltaMap(movements);
  const currentSellableOnHand = deltas.get(normalizedProductCode) ?? 0;

  if (!Number.isFinite(currentSellableOnHand)) {
    throw new Error('current sellable on-hand is not finite');
  }

  const delta = targetSellableOnHand - currentSellableOnHand;

  if (Math.abs(delta) <= tolerance) {
    return {
      normalizedProductCode,
      currentSellableOnHand,
      targetSellableOnHand,
      delta: 0,
      action: 'noop',
    };
  }

  if (delta > 0) {
    return {
      normalizedProductCode,
      currentSellableOnHand,
      targetSellableOnHand,
      delta,
      action: 'create_movement',
      movement: {
        fromBucket: 'scrap',
        toBucket: 'sellable',
        quantity: delta,
      },
    };
  }

  return {
    normalizedProductCode,
    currentSellableOnHand,
    targetSellableOnHand,
    delta,
    action: 'create_movement',
    movement: {
      fromBucket: 'sellable',
      toBucket: negativeToBucket,
      quantity: Math.abs(delta),
    },
  };
}
