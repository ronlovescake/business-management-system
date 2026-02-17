import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  buildBucketDeltaMap,
  normalizeProductCode,
} from '@/lib/inventory/movements';
import { isFulfilledStatus, isReservedStatus } from '@/lib/inventory/statuses';

export const dynamic = 'force-dynamic';

interface StockCheckRequest {
  productCode: string;
  requestedQuantity?: number;
}

interface StockCheckResponse {
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
  bundleSku: string;
  components: BundleComponent[];
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

type TransactionRecord = {
  productCode: string | null;
  quantity: number | null;
  orderStatus: string | null;
};

const LOW_STOCK_THRESHOLD = 20;

const gmPrisma = prisma as unknown as {
  generalMerchandiseBundleBatch: typeof prisma.bundleBatch;
  generalMerchandiseInventoryMovement: typeof prisma.inventoryMovement;
  generalMerchandiseProduct: typeof prisma.product;
  generalMerchandiseTransaction: typeof prisma.transaction;
};

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

function buildBundleMaps(bundles: BundleBatch[]) {
  const componentsBySku = new Map<string, BundleComponent[]>();
  const bundleSkusByComponent = new Map<string, Set<string>>();

  bundles.forEach((bundle) => {
    const normalizedSku = normalizeProductCode(bundle.bundleSku);
    if (!normalizedSku) {
      return;
    }

    const filteredComponents = (bundle.components || []).filter(
      (component) =>
        Boolean(normalizeProductCode(component.componentProductCode)) &&
        Number.isFinite(component.includedQuantity) &&
        component.includedQuantity > 0
    );

    componentsBySku.set(normalizedSku, filteredComponents);

    filteredComponents.forEach((component) => {
      const normalizedComponent = normalizeProductCode(
        component.componentProductCode
      );
      if (!normalizedComponent) {
        return;
      }

      if (!bundleSkusByComponent.has(normalizedComponent)) {
        bundleSkusByComponent.set(normalizedComponent, new Set());
      }

      bundleSkusByComponent.get(normalizedComponent)?.add(normalizedSku);
    });
  });

  return { componentsBySku, bundleSkusByComponent };
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
    return { productCode: { equals: '' } }; // yields empty result set
  }

  return {
    OR: filters,
  };
}

/**
 * POST /api/general-merchandise/inventory/check-stock
 * Checks if a product or bundle has sufficient stock available
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as StockCheckRequest;
    const { productCode, requestedQuantity = 0 } = body;

    if (!productCode) {
      return NextResponse.json(
        { error: 'Product code is required' },
        { status: 400 }
      );
    }

    const normalizedProductCode = normalizeProductCode(productCode);

    const bundles = (await gmPrisma.generalMerchandiseBundleBatch.findMany({
      include: { components: true },
    })) as unknown as BundleBatch[];

    const { componentsBySku, bundleSkusByComponent } = buildBundleMaps(bundles);

    const product = await gmPrisma.generalMerchandiseProduct.findFirst({
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

    // CASE 1: Bundle SKU - validate against components
    if (bundleComponents?.length) {
      const componentCodes = bundleComponents.map(
        (c) => c.componentProductCode
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
        productCode,
      ];

      const movementCodes = Array.from(
        new Set([
          ...componentCodes,
          productCode,
          ...bundleSkusSharingComponents,
        ])
      );

      const movements =
        (await gmPrisma.generalMerchandiseInventoryMovement.findMany({
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
        })) as unknown as MovementRecord[];

      const transactions =
        await gmPrisma.generalMerchandiseTransaction.findMany({
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

      const products = await gmPrisma.generalMerchandiseProduct.findMany({
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
      products.forEach((p) => {
        const normalizedCode = normalizeProductCode(p.productCode);
        if (normalizedCode) {
          productQuantityMap.set(normalizedCode, p.quantity ?? 0);
        }
      });

      const actualQuantityMap = buildActualQuantityMap({
        baseQuantityMap: productQuantityMap,
        movements,
      });

      const bundleSellableSupplyBySku = new Map<string, number>();
      [productCode, ...bundleSkusSharingComponents]
        .map((code) => normalizeProductCode(code))
        .filter(Boolean)
        .forEach((bundleSku) => {
          bundleSellableSupplyBySku.set(
            bundleSku,
            actualQuantityMap.get(bundleSku) ?? 0
          );
        });

      const { componentDemandByProduct, bundleDemandBySku } = accumulateDemand(
        transactions,
        componentsBySku,
        bundleSellableSupplyBySku
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

        const supply = actualQuantityMap.get(normalizedCode) ?? 0;
        const demand = componentDemandByProduct.get(normalizedCode) ?? 0;
        const available = supply - demand;

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

      const bundleSellableSupply =
        actualQuantityMap.get(normalizedProductCode) ?? 0;
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

      return NextResponse.json(
        summarizeStatus(
          productCode,
          bundleAvailable,
          requestedQuantity,
          shortageMessage
        ),
        { status: 200 }
      );
    }

    // CASE 2: Regular product code - include bundle demand that consumes this SKU
    if (!product) {
      return NextResponse.json(
        summarizeStatus(
          productCode,
          0,
          requestedQuantity,
          `Product "${productCode}" not found`
        )
      );
    }

    const bundleSkusThatUseProduct = Array.from(
      bundleSkusByComponent.get(normalizedProductCode) ?? []
    );

    const transactionProductCodes = [productCode, ...bundleSkusThatUseProduct];

    const transactions = await gmPrisma.generalMerchandiseTransaction.findMany({
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

    const movementCodes = [productCode, ...bundleSkusThatUseProduct];
    const movements =
      (await gmPrisma.generalMerchandiseInventoryMovement.findMany({
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
      })) as unknown as MovementRecord[];

    const bundleProducts = bundleSkusThatUseProduct.length
      ? await gmPrisma.generalMerchandiseProduct.findMany({
          where: buildTransactionWhereClause(bundleSkusThatUseProduct),
          select: {
            productCode: true,
            quantity: true,
          },
        })
      : [];

    const bundleQuantityMap = new Map<string, number>();
    bundleProducts.forEach((p) => {
      const normalizedCode = normalizeProductCode(p.productCode);
      if (normalizedCode) {
        bundleQuantityMap.set(normalizedCode, p.quantity ?? 0);
      }
    });

    const productBaseQuantityMap = new Map<string, number>(bundleQuantityMap);
    productBaseQuantityMap.set(
      normalizedProductCode,
      Math.max(product.quantity ?? 0, 0)
    );

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

    const totalOrderRaw =
      componentDemandByProduct.get(normalizedProductCode) ?? 0;
    const totalOrder = Math.max(totalOrderRaw, 0);
    const onhand = actualQuantityMap.get(normalizedProductCode) ?? 0;
    const availableStock = onhand - totalOrder;

    return NextResponse.json(
      summarizeStatus(productCode, availableStock, requestedQuantity),
      { status: 200 }
    );
  } catch (error) {
    logger.error('Error checking GM stock:', error);
    return NextResponse.json(
      { error: 'Failed to check stock availability' },
      { status: 500 }
    );
  }
}
