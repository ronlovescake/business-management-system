import { prisma } from '@/lib/db';
import {
  buildBucketDeltaMap,
  getSellableOnHand,
  normalizeProductCode,
} from '@/lib/inventory/movements';
import { isFulfilledStatus, isReservedStatus } from '@/lib/inventory/statuses';
import { isStoredMixAndMatchName } from '@/lib/inventory/mixAndMatchTag';
import { allocateByAvailability } from '../lib/mixAndMatchAllocation';

export interface StockCheckRequest {
  productCode: string;
  requestedQuantity?: number;
}

export interface StockCheckResponse {
  productCode: string;
  availableStock: number;
  requestedQuantity: number;
  status: 'IN_STOCK' | 'LOW_STOCK' | 'INSUFFICIENT_STOCK' | 'SOLD_OUT';
  canFulfill: boolean;
  message: string;
}

type BundleComponent = {
  componentProductCode: string;
  includedQuantity: number;
};

type BundleBatch = {
  bundleName: string;
  bundleSku: string;
  components: BundleComponent[];
};

type MixAndMatchBatch = BundleBatch;

type TransactionRecord = {
  productCode: string | null;
  quantity: number | null;
  orderStatus: string | null;
};

type MovementRecord = {
  productCode: string;
  quantity: number;
  fromBucket:
    | 'sellable'
    | 'damaged_hold'
    | 'reserved'
    | 'assembly_wip'
    | 'scrap'
    | 'supplier_short'
    | 'opening_inventory'
    | 'sold';
  toBucket:
    | 'sellable'
    | 'damaged_hold'
    | 'reserved'
    | 'assembly_wip'
    | 'scrap'
    | 'supplier_short'
    | 'opening_inventory'
    | 'sold';
  notes?: string | null;
};

const LOW_STOCK_THRESHOLD = 20;

function toBundleBatch(row: {
  bundleName: string;
  bundleSku: string;
  components: Array<{ componentProductCode: string; includedQuantity: number }>;
}): BundleBatch {
  return {
    bundleName: row.bundleName,
    bundleSku: row.bundleSku,
    components: row.components.map((component) => ({
      componentProductCode: component.componentProductCode,
      includedQuantity: component.includedQuantity,
    })),
  };
}

function toMovementRecord(row: {
  productCode: string;
  quantity: number;
  fromBucket: MovementRecord['fromBucket'];
  toBucket: MovementRecord['toBucket'];
  notes: string | null;
}): MovementRecord {
  return {
    productCode: row.productCode,
    quantity: row.quantity,
    fromBucket: row.fromBucket,
    toBucket: row.toBucket,
    notes: row.notes,
  };
}

function isActiveDemandStatus(value: string | null | undefined): boolean {
  return isReservedStatus(value) || isFulfilledStatus(value);
}

function buildActualQuantityMap(params: {
  baseQuantityMap: Map<string, number>;
  movements: MovementRecord[];
}) {
  const { baseQuantityMap, movements } = params;
  const damagedDeltaByProduct = buildBucketDeltaMap(movements, 'damaged_hold');
  const supplierShortDeltaByProduct = buildBucketDeltaMap(
    movements,
    'supplier_short'
  );
  const additionalsByProduct = new Map<string, number>();

  movements.forEach((movement) => {
    const code = normalizeProductCode(movement.productCode);
    if (!code || !Number.isFinite(movement.quantity)) {
      return;
    }

    if (
      movement.fromBucket === 'supplier_short' &&
      movement.toBucket === 'sellable' &&
      (movement.notes ?? '').toLowerCase().startsWith('additionals')
    ) {
      const current = additionalsByProduct.get(code) ?? 0;
      additionalsByProduct.set(code, current + movement.quantity);
    }
  });

  const actualQuantityMap = new Map<string, number>();
  const allCodes = new Set<string>([
    ...Array.from(baseQuantityMap.keys()),
    ...Array.from(damagedDeltaByProduct.keys()),
    ...Array.from(supplierShortDeltaByProduct.keys()),
    ...Array.from(additionalsByProduct.keys()),
  ]);

  allCodes.forEach((code) => {
    const base = baseQuantityMap.get(code) ?? 0;
    const damaged = damagedDeltaByProduct.get(code) ?? 0;
    const supplierShort = supplierShortDeltaByProduct.get(code) ?? 0;
    const additionals = additionalsByProduct.get(code) ?? 0;
    actualQuantityMap.set(
      code,
      Math.max(base + additionals - supplierShort - damaged, 0)
    );
  });

  return actualQuantityMap;
}

function summarizeStatus(
  productCode: string,
  availableStock: number,
  requestedQuantity: number,
  shortageMessage?: string
): StockCheckResponse {
  let status: StockCheckResponse['status'];
  let canFulfill: boolean;
  let message: string;

  if (availableStock <= 0) {
    status = 'SOLD_OUT';
    canFulfill = false;
    message =
      shortageMessage ??
      `Product "${productCode}" is sold out (0 units available)`;
  } else if (availableStock < requestedQuantity) {
    status = 'INSUFFICIENT_STOCK';
    canFulfill = false;
    message =
      shortageMessage ??
      `The quantity requested exceeds the available stock.\n\nOnly ${availableStock} units are currently in stock.`;
  } else if (availableStock <= LOW_STOCK_THRESHOLD) {
    status = 'LOW_STOCK';
    canFulfill = true;
    const remainingAfterOrder = availableStock - requestedQuantity;
    message = shortageMessage ?? `Only ${remainingAfterOrder} units remaining`;
  } else {
    status = 'IN_STOCK';
    canFulfill = true;
    message = shortageMessage ?? `${availableStock} units available`;
  }

  return {
    productCode,
    availableStock,
    requestedQuantity,
    status,
    canFulfill,
    message,
  };
}

function buildSkuComponentMaps(params: {
  rows: BundleBatch[];
  requirePositiveIncludedQuantity: boolean;
}) {
  const { rows, requirePositiveIncludedQuantity } = params;
  const componentsBySku = new Map<string, BundleComponent[]>();
  const skusByComponent = new Map<string, Set<string>>();

  rows.forEach((row) => {
    const normalizedSku = normalizeProductCode(row.bundleSku);
    if (!normalizedSku) {
      return;
    }

    const filteredComponents = (row.components || []).filter((component) => {
      const normalizedComponent = normalizeProductCode(
        component.componentProductCode
      );
      if (!normalizedComponent) {
        return false;
      }

      if (!requirePositiveIncludedQuantity) {
        return true;
      }

      return (
        Number.isFinite(component.includedQuantity) &&
        component.includedQuantity > 0
      );
    });

    componentsBySku.set(normalizedSku, filteredComponents);

    filteredComponents.forEach((component) => {
      const normalizedComponent = normalizeProductCode(
        component.componentProductCode
      );
      if (!normalizedComponent) {
        return;
      }

      if (!skusByComponent.has(normalizedComponent)) {
        skusByComponent.set(normalizedComponent, new Set());
      }

      skusByComponent.get(normalizedComponent)?.add(normalizedSku);
    });
  });

  return { componentsBySku, skusByComponent };
}

function buildBundleMaps(bundles: BundleBatch[]) {
  const { componentsBySku, skusByComponent } = buildSkuComponentMaps({
    rows: bundles,
    requirePositiveIncludedQuantity: true,
  });

  return { componentsBySku, bundleSkusByComponent: skusByComponent };
}

function buildMixAndMatchMaps(mixAndMatchRows: MixAndMatchBatch[]) {
  const { componentsBySku, skusByComponent } = buildSkuComponentMaps({
    rows: mixAndMatchRows,
    requirePositiveIncludedQuantity: false,
  });

  return { componentsBySku, mixSkusByComponent: skusByComponent };
}

function accumulateMixDemand(
  transactions: TransactionRecord[],
  mixComponentsBySku: Map<string, BundleComponent[]>,
  initialAvailableByComponent: Map<string, number>
) {
  const mixDemandBySku = new Map<string, number>();

  transactions.forEach((transaction) => {
    if (!isActiveDemandStatus(transaction.orderStatus)) {
      return;
    }

    const normalizedProductCode = normalizeProductCode(transaction.productCode);
    const quantity = Math.max(transaction.quantity ?? 0, 0);
    if (!normalizedProductCode || quantity <= 0) {
      return;
    }

    if (!mixComponentsBySku.has(normalizedProductCode)) {
      return;
    }

    mixDemandBySku.set(
      normalizedProductCode,
      (mixDemandBySku.get(normalizedProductCode) ?? 0) + quantity
    );
  });

  const componentDemandByProduct = new Map<string, number>();
  const remainingByComponent = new Map<string, number>();

  initialAvailableByComponent.forEach((available, componentCode) => {
    remainingByComponent.set(componentCode, Math.max(available, 0));
  });

  const orderedMixSkus = Array.from(mixDemandBySku.keys()).sort((a, b) =>
    a.localeCompare(b)
  );

  orderedMixSkus.forEach((mixSku) => {
    const mixDemand = mixDemandBySku.get(mixSku) ?? 0;
    if (mixDemand <= 0) {
      return;
    }

    const componentAvailabilityMap = new Map<string, number>();
    (mixComponentsBySku.get(mixSku) ?? []).forEach((component) => {
      const normalizedComponent = normalizeProductCode(
        component.componentProductCode
      );
      if (!normalizedComponent) {
        return;
      }

      componentAvailabilityMap.set(
        normalizedComponent,
        remainingByComponent.get(normalizedComponent) ?? 0
      );
    });

    const allocation = allocateByAvailability(
      Array.from(componentAvailabilityMap.entries()).map(
        ([key, available]) => ({
          key,
          available,
        })
      ),
      mixDemand
    );

    allocation.forEach((item) => {
      if (item.allocated <= 0) {
        return;
      }

      componentDemandByProduct.set(
        item.key,
        (componentDemandByProduct.get(item.key) ?? 0) + item.allocated
      );

      remainingByComponent.set(
        item.key,
        (remainingByComponent.get(item.key) ?? 0) - item.allocated
      );
    });
  });

  return { componentDemandByProduct, remainingByComponent };
}

function accumulateDemand(
  transactions: TransactionRecord[],
  componentsBySku: Map<string, BundleComponent[]>,
  bundleSellableSupplyBySku: Map<string, number>
): {
  componentDemandByProduct: Map<string, number>;
  bundleDemandBySku: Map<string, number>;
} {
  const directDemandByProduct = new Map<string, number>();
  const bundleDemandBySku = new Map<string, number>();

  transactions.forEach((transaction) => {
    if (!isActiveDemandStatus(transaction.orderStatus)) {
      return;
    }

    const normalizedProductCode = normalizeProductCode(transaction.productCode);
    const quantity = transaction.quantity ?? 0;
    if (!normalizedProductCode || quantity <= 0) {
      return;
    }

    const bundleComponents = componentsBySku.get(normalizedProductCode);

    if (bundleComponents?.length) {
      const current = bundleDemandBySku.get(normalizedProductCode) ?? 0;
      bundleDemandBySku.set(normalizedProductCode, current + quantity);
      return;
    }

    const current = directDemandByProduct.get(normalizedProductCode) ?? 0;
    directDemandByProduct.set(normalizedProductCode, current + quantity);
  });

  const componentDemandByProduct = new Map(directDemandByProduct);
  bundleDemandBySku.forEach((bundleDemand, bundleSku) => {
    const bundleSellableSupply = bundleSellableSupplyBySku.get(bundleSku) ?? 0;
    const overflowBundlesNeeded = Math.max(
      bundleDemand - bundleSellableSupply,
      0
    );
    if (overflowBundlesNeeded <= 0) {
      return;
    }

    const components = componentsBySku.get(bundleSku) ?? [];
    components.forEach((component) => {
      const componentCode = normalizeProductCode(
        component.componentProductCode
      );
      if (!componentCode) {
        return;
      }

      const current = componentDemandByProduct.get(componentCode) ?? 0;
      componentDemandByProduct.set(
        componentCode,
        current + overflowBundlesNeeded * component.includedQuantity
      );
    });
  });

  return { componentDemandByProduct, bundleDemandBySku };
}

function buildTransactionWhereClause(codes: string[]) {
  const filters = codes
    .map((code) => code.trim())
    .filter(Boolean)
    .map((code) => ({
      productCode: { equals: code, mode: 'insensitive' as const },
    }));

  if (filters.length === 0) {
    return { productCode: { equals: '' } };
  }

  return {
    OR: filters,
  };
}

export async function checkClothingStock(
  params: StockCheckRequest
): Promise<StockCheckResponse> {
  const { productCode, requestedQuantity = 0 } = params;
  const normalizedProductCode = normalizeProductCode(productCode);

  const allCompositeRows = await prisma.bundleBatch.findMany({
    select: {
      bundleName: true,
      bundleSku: true,
      components: {
        select: {
          componentProductCode: true,
          includedQuantity: true,
        },
      },
    },
  });
  const compositeBatches: BundleBatch[] = allCompositeRows.map(toBundleBatch);

  const bundles = compositeBatches.filter(
    (row) => !isStoredMixAndMatchName(row.bundleName)
  );
  const mixAndMatchRows = compositeBatches.filter((row) =>
    isStoredMixAndMatchName(row.bundleName)
  );

  const { componentsBySku, bundleSkusByComponent } = buildBundleMaps(bundles);
  const { componentsBySku: mixComponentsBySku, mixSkusByComponent } =
    buildMixAndMatchMaps(mixAndMatchRows);

  const product = await prisma.product.findFirst({
    where: {
      productCode: {
        equals: productCode.trim(),
        mode: 'insensitive',
      },
    },
    select: {
      quantity: true,
    },
  });

  const bundleComponents = componentsBySku.get(normalizedProductCode);
  const mixComponents = mixComponentsBySku.get(normalizedProductCode);

  if (mixComponents?.length) {
    const componentCodes = Array.from(
      new Set(mixComponents.map((component) => component.componentProductCode))
    );
    const bundleSkusSharingComponents = Array.from(
      new Set(
        componentCodes.flatMap((code) =>
          Array.from(
            bundleSkusByComponent.get(normalizeProductCode(code)) ?? []
          )
        )
      )
    );

    const transactionProductCodes = [
      ...componentCodes,
      ...bundleSkusSharingComponents,
    ];

    const transactions = await prisma.transaction.findMany({
      where: {
        orderStatus: {
          not: 'Cancelled',
        },
        ...buildTransactionWhereClause(transactionProductCodes),
      },
      select: {
        productCode: true,
        quantity: true,
        orderStatus: true,
      },
    });

    const products = await prisma.product.findMany({
      where: buildTransactionWhereClause([
        ...componentCodes,
        ...bundleSkusSharingComponents,
      ]),
      select: {
        productCode: true,
        quantity: true,
      },
    });

    const productQuantityMap = new Map<string, number>();
    products.forEach((current) => {
      const normalizedCode = normalizeProductCode(current.productCode);
      if (!normalizedCode) {
        return;
      }

      productQuantityMap.set(normalizedCode, current.quantity ?? 0);
    });

    const movementCodes = Array.from(
      new Set([...componentCodes, ...bundleSkusSharingComponents])
    );
    const movementRows = await prisma.inventoryMovement.findMany({
      where: {
        deletedAt: null,
        productCode: { in: movementCodes },
      },
      select: {
        productCode: true,
        quantity: true,
        fromBucket: true,
        toBucket: true,
        notes: true,
      },
    });
    const movements: MovementRecord[] = movementRows.map(toMovementRecord);

    const actualQuantityMap = buildActualQuantityMap({
      baseQuantityMap: productQuantityMap,
      movements,
    });

    const getSellableOnHandWithFallback = (code: string) =>
      getSellableOnHand({
        productCode: code,
        sellableDeltaByProduct: new Map(),
        fallbackQuantity:
          actualQuantityMap.get(normalizeProductCode(code)) ?? 0,
      });

    const bundleSellableSupplyBySku = new Map<string, number>();
    bundleSkusSharingComponents.forEach((bundleSku) => {
      const normalizedSku = normalizeProductCode(bundleSku);
      if (!normalizedSku) {
        return;
      }

      bundleSellableSupplyBySku.set(
        normalizedSku,
        getSellableOnHandWithFallback(bundleSku)
      );
    });

    const { componentDemandByProduct } = accumulateDemand(
      transactions,
      componentsBySku,
      bundleSellableSupplyBySku
    );

    const initialAvailableByComponent = new Map<string, number>();
    componentCodes.forEach((componentCode) => {
      const normalizedCode = normalizeProductCode(componentCode);
      if (!normalizedCode) {
        return;
      }

      const supply = getSellableOnHandWithFallback(componentCode);
      const demandRaw = componentDemandByProduct.get(normalizedCode) ?? 0;
      initialAvailableByComponent.set(
        normalizedCode,
        Math.max(supply - demandRaw, 0)
      );
    });

    const availableStock = componentCodes.reduce((sum, componentCode) => {
      const normalizedCode = normalizeProductCode(componentCode);
      if (!normalizedCode) {
        return sum;
      }

      return (
        sum + Math.max(initialAvailableByComponent.get(normalizedCode) ?? 0, 0)
      );
    }, 0);

    return summarizeStatus(productCode, availableStock, requestedQuantity);
  }

  if (bundleComponents?.length) {
    const componentCodes = bundleComponents.map((c) => c.componentProductCode);
    const bundleSkusSharingComponents = Array.from(
      new Set(
        componentCodes.flatMap((code) =>
          Array.from(
            bundleSkusByComponent.get(normalizeProductCode(code)) ?? []
          )
        )
      )
    );

    const mixSkusSharingComponents = Array.from(
      new Set(
        componentCodes.flatMap((code) =>
          Array.from(mixSkusByComponent.get(normalizeProductCode(code)) ?? [])
        )
      )
    );

    const transactionProductCodes = [
      ...componentCodes,
      ...bundleSkusSharingComponents,
      ...mixSkusSharingComponents,
      productCode,
    ];

    const transactions = await prisma.transaction.findMany({
      where: {
        orderStatus: {
          not: 'Cancelled',
        },
        ...buildTransactionWhereClause(transactionProductCodes),
      },
      select: {
        productCode: true,
        quantity: true,
        orderStatus: true,
      },
    });

    const products = await prisma.product.findMany({
      where: buildTransactionWhereClause([
        ...componentCodes,
        productCode,
        ...bundleSkusSharingComponents,
      ]),
      select: {
        productCode: true,
        quantity: true,
      },
    });

    const productQuantityMap = new Map<string, number>();
    products.forEach((current) => {
      const normalizedCode = normalizeProductCode(current.productCode);
      if (normalizedCode) {
        productQuantityMap.set(normalizedCode, current.quantity ?? 0);
      }
    });

    const movementCodes = Array.from(
      new Set([...componentCodes, productCode, ...bundleSkusSharingComponents])
    );
    const movementRows = await prisma.inventoryMovement.findMany({
      where: {
        deletedAt: null,
        productCode: { in: movementCodes },
      },
      select: {
        productCode: true,
        quantity: true,
        fromBucket: true,
        toBucket: true,
        notes: true,
      },
    });
    const movements: MovementRecord[] = movementRows.map(toMovementRecord);

    const actualQuantityMap = buildActualQuantityMap({
      baseQuantityMap: productQuantityMap,
      movements,
    });

    const getSellableOnHandWithFallback = (code: string) =>
      getSellableOnHand({
        productCode: code,
        sellableDeltaByProduct: new Map(),
        fallbackQuantity:
          actualQuantityMap.get(normalizeProductCode(code)) ?? 0,
      });

    const bundleSellableSupplyBySku = new Map<string, number>();
    [productCode, ...bundleSkusSharingComponents]
      .map((code) => normalizeProductCode(code))
      .filter(Boolean)
      .forEach((bundleSku) => {
        bundleSellableSupplyBySku.set(
          bundleSku,
          getSellableOnHandWithFallback(bundleSku)
        );
      });

    const { componentDemandByProduct, bundleDemandBySku } = accumulateDemand(
      transactions,
      componentsBySku,
      bundleSellableSupplyBySku
    );

    const allMixComponentCodes = Array.from(
      new Set(
        mixSkusSharingComponents.flatMap((mixSku) =>
          (mixComponentsBySku.get(normalizeProductCode(mixSku)) ?? []).map(
            (component) => component.componentProductCode
          )
        )
      )
    );

    const initialAvailableByComponent = new Map<string, number>();
    allMixComponentCodes.forEach((componentCode) => {
      const normalizedCode = normalizeProductCode(componentCode);
      if (!normalizedCode) {
        return;
      }

      const supply = getSellableOnHandWithFallback(componentCode);
      const demandRaw = componentDemandByProduct.get(normalizedCode) ?? 0;
      initialAvailableByComponent.set(
        normalizedCode,
        Math.max(supply - demandRaw, 0)
      );
    });

    const { componentDemandByProduct: mixDemandByProduct } =
      accumulateMixDemand(
        transactions,
        mixComponentsBySku,
        initialAvailableByComponent
      );

    let limitingAvailable = Number.POSITIVE_INFINITY;
    let limitingComponent: string | null = null;

    bundleComponents.forEach((component) => {
      const normalizedCode = normalizeProductCode(
        component.componentProductCode
      );
      if (!normalizedCode) {
        return;
      }

      const supply = getSellableOnHandWithFallback(
        component.componentProductCode
      );
      const demandRaw =
        (componentDemandByProduct.get(normalizedCode) ?? 0) +
        (mixDemandByProduct.get(normalizedCode) ?? 0);
      const available = supply - demandRaw;
      const availableBundles = Math.floor(
        available / Math.max(component.includedQuantity, 1)
      );

      if (availableBundles < limitingAvailable) {
        limitingAvailable = availableBundles;
        limitingComponent = component.componentProductCode;
      }
    });

    const componentBundlesAvailable = Number.isFinite(limitingAvailable)
      ? Math.max(limitingAvailable, 0)
      : 0;

    const bundleSellableSupply = getSellableOnHandWithFallback(productCode);
    const bundleDemandRaw = bundleDemandBySku.get(normalizedProductCode) ?? 0;
    const assembledAvailable = Math.max(
      bundleSellableSupply - bundleDemandRaw,
      0
    );

    const bundleAvailable = assembledAvailable + componentBundlesAvailable;
    const shortageMessage =
      limitingComponent !== null
        ? `Bundle availability: ${assembledAvailable} assembled + ${componentBundlesAvailable} via components (limited by ${limitingComponent})`
        : undefined;

    return summarizeStatus(
      productCode,
      bundleAvailable,
      requestedQuantity,
      shortageMessage
    );
  }

  if (!product) {
    return summarizeStatus(
      productCode,
      0,
      requestedQuantity,
      `Product "${productCode}" not found`
    );
  }

  const bundleSkusThatUseProduct = Array.from(
    bundleSkusByComponent.get(normalizedProductCode) ?? []
  );
  const mixSkusThatUseProduct = Array.from(
    mixSkusByComponent.get(normalizeProductCode(productCode)) ?? []
  );

  const transactionProductCodes = [
    productCode,
    ...bundleSkusThatUseProduct,
    ...mixSkusThatUseProduct,
  ];

  const mixComponentCodes = Array.from(
    new Set(
      mixSkusThatUseProduct.flatMap((mixSku) =>
        (mixComponentsBySku.get(normalizeProductCode(mixSku)) ?? []).map(
          (component) => component.componentProductCode
        )
      )
    )
  );

  const transactions = await prisma.transaction.findMany({
    where: {
      orderStatus: {
        not: 'Cancelled',
      },
      ...buildTransactionWhereClause(transactionProductCodes),
    },
    select: {
      productCode: true,
      quantity: true,
      orderStatus: true,
    },
  });

  const bundleProducts =
    bundleSkusThatUseProduct.length || mixComponentCodes.length
      ? await prisma.product.findMany({
          where: buildTransactionWhereClause([
            ...bundleSkusThatUseProduct,
            ...mixComponentCodes,
          ]),
          select: {
            productCode: true,
            quantity: true,
          },
        })
      : [];

  const bundleQuantityMap = new Map<string, number>();
  bundleProducts.forEach((current) => {
    const normalizedCode = normalizeProductCode(current.productCode);
    if (normalizedCode) {
      bundleQuantityMap.set(normalizedCode, current.quantity ?? 0);
    }
  });

  const productBaseQuantityMap = new Map<string, number>(bundleQuantityMap);
  productBaseQuantityMap.set(
    normalizedProductCode,
    Math.max(product.quantity ?? 0, 0)
  );

  const movementCodes = [
    productCode,
    ...bundleSkusThatUseProduct,
    ...mixComponentCodes,
  ];
  const movementRows = await prisma.inventoryMovement.findMany({
    where: {
      deletedAt: null,
      productCode: { in: movementCodes },
    },
    select: {
      productCode: true,
      quantity: true,
      fromBucket: true,
      toBucket: true,
      notes: true,
    },
  });
  const movements: MovementRecord[] = movementRows.map(toMovementRecord);

  const actualQuantityMap = buildActualQuantityMap({
    baseQuantityMap: productBaseQuantityMap,
    movements,
  });

  const bundleSellableSupplyBySku = new Map<string, number>();
  bundleSkusThatUseProduct.forEach((bundleSku) => {
    const normalizedSku = normalizeProductCode(bundleSku);
    if (!normalizedSku) {
      return;
    }

    bundleSellableSupplyBySku.set(
      normalizedSku,
      actualQuantityMap.get(normalizedSku) ?? 0
    );
  });

  const { componentDemandByProduct } = accumulateDemand(
    transactions,
    componentsBySku,
    bundleSellableSupplyBySku
  );

  const initialAvailableByComponent = new Map<string, number>();
  mixComponentCodes.forEach((componentCode) => {
    const normalizedCode = normalizeProductCode(componentCode);
    if (!normalizedCode) {
      return;
    }

    const supply = getSellableOnHand({
      productCode: componentCode,
      sellableDeltaByProduct: new Map(),
      fallbackQuantity: actualQuantityMap.get(normalizedCode) ?? 0,
    });

    const demandRaw = componentDemandByProduct.get(normalizedCode) ?? 0;
    initialAvailableByComponent.set(
      normalizedCode,
      Math.max(supply - demandRaw, 0)
    );
  });

  const { componentDemandByProduct: mixDemandByProduct } = accumulateMixDemand(
    transactions,
    mixComponentsBySku,
    initialAvailableByComponent
  );

  const totalOrderRaw =
    (componentDemandByProduct.get(normalizedProductCode) ?? 0) +
    (mixDemandByProduct.get(normalizedProductCode) ?? 0);
  const totalOrder = Math.max(totalOrderRaw, 0);
  const onhand = actualQuantityMap.get(normalizedProductCode) ?? 0;
  const availableStock = onhand - totalOrder;

  return summarizeStatus(productCode, availableStock, requestedQuantity);
}
