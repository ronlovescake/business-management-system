import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  buildSellableDeltaMap,
  getSellableOnHand,
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
  fromBucket: 'sellable' | 'damaged_hold' | 'scrap' | 'sold';
  toBucket: 'sellable' | 'damaged_hold' | 'scrap' | 'sold';
};

type TransactionRecord = {
  productCode: string | null;
  quantity: number | null;
  orderStatus: string | null;
};

const LOW_STOCK_THRESHOLD = 20;

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
  componentsBySku: Map<string, BundleComponent[]>
): Map<string, number> {
  const totals = new Map<string, number>();

  transactions.forEach((transaction) => {
    const reservedStatus = isReservedStatus(transaction.orderStatus);
    const fulfilledStatus = isFulfilledStatus(transaction.orderStatus);
    const shouldCount = reservedStatus || (!reservedStatus && !fulfilledStatus);
    if (!shouldCount) {
      return;
    }

    const normalizedProductCode = normalizeProductCode(transaction.productCode);
    const quantity = transaction.quantity ?? 0;
    if (!normalizedProductCode || quantity <= 0) {
      return;
    }

    const bundleComponents = componentsBySku.get(normalizedProductCode);

    if (bundleComponents?.length) {
      bundleComponents.forEach((component) => {
        const componentCode = normalizeProductCode(
          component.componentProductCode
        );
        if (!componentCode) {
          return;
        }

        const current = totals.get(componentCode) ?? 0;
        totals.set(
          componentCode,
          current + quantity * component.includedQuantity
        );
      });
    } else {
      const current = totals.get(normalizedProductCode) ?? 0;
      totals.set(normalizedProductCode, current + quantity);
    }
  });

  return totals;
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
 * POST /api/inventory/check-stock
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

    const bundles = (await prisma.bundleBatch.findMany({
      include: { components: true },
    })) as unknown as BundleBatch[];

    const { componentsBySku, bundleSkusByComponent } = buildBundleMaps(bundles);

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
        new Set([...componentCodes, productCode])
      );

      const movements = (await prisma.inventoryMovement.findMany({
        where: {
          deletedAt: null,
          productCode: { in: movementCodes },
        },
      })) as unknown as MovementRecord[];
      const sellableDelta = buildSellableDeltaMap(movements);

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

      const demandMap = accumulateDemand(transactions, componentsBySku);

      const products = await prisma.product.findMany({
        where: buildTransactionWhereClause(componentCodes),
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

      const getSellableOnHandWithFallback = (code: string) =>
        getSellableOnHand({
          productCode: code,
          sellableDeltaByProduct: sellableDelta,
          fallbackQuantity:
            productQuantityMap.get(normalizeProductCode(code)) ?? 0,
        });

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
        const demand = demandMap.get(normalizedCode) ?? 0;
        const available = supply - demand;

        const availableBundles = Math.floor(
          available / Math.max(component.includedQuantity, 1)
        );

        if (availableBundles < limitingAvailable) {
          limitingAvailable = availableBundles;
          limitingComponent = component.componentProductCode;
        }
      });

      const bundleAvailable = Number.isFinite(limitingAvailable)
        ? Math.max(limitingAvailable, 0)
        : 0;

      const shortageMessage =
        limitingComponent !== null
          ? `Bundle limited by ${limitingComponent}: ${bundleAvailable} bundle(s) available`
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

    const demandMap = accumulateDemand(transactions, componentsBySku);

    const movementCodes = [productCode, ...bundleSkusThatUseProduct];
    const movements = (await prisma.inventoryMovement.findMany({
      where: {
        deletedAt: null,
        productCode: { in: movementCodes },
      },
    })) as unknown as MovementRecord[];
    const sellableDelta = buildSellableDeltaMap(movements);

    const totalOrder = demandMap.get(normalizedProductCode) ?? 0;
    const onhand = getSellableOnHand({
      productCode,
      sellableDeltaByProduct: sellableDelta,
      fallbackQuantity: product.quantity ?? 0,
    });
    const availableStock = onhand - totalOrder;

    return NextResponse.json(
      summarizeStatus(productCode, availableStock, requestedQuantity),
      { status: 200 }
    );
  } catch (error) {
    logger.error('Error checking stock:', error);
    return NextResponse.json(
      { error: 'Failed to check stock availability' },
      { status: 500 }
    );
  }
}
