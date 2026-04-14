import { normalizeProductCode } from '@/lib/inventory/movements';

export type SplitBatchLike = {
  splitSku: string;
  components: Array<{
    componentSku: string;
    includedQuantity: number;
  }>;
};

export type SplitDemandTransactionLike = {
  productCode: string | null;
  quantity: number | null;
  orderStatus: string | null;
  unitPrice?: number | null;
};

export type SplitChildAllocation = {
  parentSku: string;
  soldOpenedSets: number;
  reservedOpenedSets: number;
  totalOpenedSets: number;
  remainingParentSets: number | null;
  childRevenue: number;
  childLooseBySku: Map<string, number>;
  childAvailableBySku: Map<string, number>;
  childSoldDemandBySku: Map<string, number>;
  childReservedDemandBySku: Map<string, number>;
  childActiveDemandBySku: Map<string, number>;
};

function incrementMap(map: Map<string, number>, key: string, amount: number) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

export function buildSplitBatchMaps(splitBatches: SplitBatchLike[]) {
  const splitBatchByParentSku = new Map<string, SplitBatchLike>();
  const splitParentByChildSku = new Map<
    string,
    { parentSku: string; includedQuantity: number }
  >();

  splitBatches.forEach((batch) => {
    const normalizedParentSku = normalizeProductCode(batch.splitSku);
    if (!normalizedParentSku) {
      return;
    }

    splitBatchByParentSku.set(normalizedParentSku, batch);

    batch.components.forEach((component) => {
      const normalizedChildSku = normalizeProductCode(component.componentSku);
      if (!normalizedChildSku) {
        return;
      }

      splitParentByChildSku.set(normalizedChildSku, {
        parentSku: normalizedParentSku,
        includedQuantity: Math.max(Number(component.includedQuantity) || 1, 1),
      });
    });
  });

  return {
    splitBatchByParentSku,
    splitParentByChildSku,
  };
}

function computeOpenedSetsForDemand(
  batch: SplitBatchLike,
  demandBySku: Map<string, number>
) {
  let openedSets = 0;

  batch.components.forEach((component) => {
    const normalizedChildSku = normalizeProductCode(component.componentSku);
    if (!normalizedChildSku) {
      return;
    }

    const demand = demandBySku.get(normalizedChildSku) ?? 0;
    const includedQuantity = Math.max(Number(component.includedQuantity) || 1, 1);
    openedSets = Math.max(openedSets, Math.ceil(demand / includedQuantity));
  });

  return openedSets;
}

export function summarizeSplitChildAllocations(params: {
  splitBatches: SplitBatchLike[];
  transactions: SplitDemandTransactionLike[];
  isSoldStatus: (status: string | null | undefined) => boolean;
  isReservedStatus: (status: string | null | undefined) => boolean;
  isRevenueStatus: (status: string | null | undefined) => boolean;
  parentOnHandBySku?: Map<string, number>;
  directParentReservedBySku?: Map<string, number>;
  directParentSoldBySku?: Map<string, number>;
}) {
  const {
    splitBatches,
    transactions,
    isSoldStatus,
    isReservedStatus,
    isRevenueStatus,
    parentOnHandBySku,
    directParentReservedBySku,
    directParentSoldBySku,
  } = params;

  const { splitBatchByParentSku, splitParentByChildSku } = buildSplitBatchMaps(
    splitBatches
  );

  const childSoldDemandByParent = new Map<string, Map<string, number>>();
  const childReservedDemandByParent = new Map<string, Map<string, number>>();
  const childRevenueByParent = new Map<string, number>();

  transactions.forEach((transaction) => {
    const normalizedProductCode = normalizeProductCode(transaction.productCode);
    const quantity = Math.max(transaction.quantity ?? 0, 0);
    if (!normalizedProductCode || quantity <= 0) {
      return;
    }

    const splitChild = splitParentByChildSku.get(normalizedProductCode);
    if (!splitChild) {
      return;
    }

    const parentSku = splitChild.parentSku;
    const status = transaction.orderStatus;

    if (isSoldStatus(status)) {
      if (!childSoldDemandByParent.has(parentSku)) {
        childSoldDemandByParent.set(parentSku, new Map<string, number>());
      }
      incrementMap(
        childSoldDemandByParent.get(parentSku) as Map<string, number>,
        normalizedProductCode,
        quantity
      );
    } else if (isReservedStatus(status)) {
      if (!childReservedDemandByParent.has(parentSku)) {
        childReservedDemandByParent.set(parentSku, new Map<string, number>());
      }
      incrementMap(
        childReservedDemandByParent.get(parentSku) as Map<string, number>,
        normalizedProductCode,
        quantity
      );
    }

    if (isRevenueStatus(status)) {
      const unitPrice = Number(transaction.unitPrice ?? 0) || 0;
      childRevenueByParent.set(
        parentSku,
        (childRevenueByParent.get(parentSku) ?? 0) + unitPrice * quantity
      );
    }
  });

  const allocations = new Map<string, SplitChildAllocation>();

  splitBatchByParentSku.forEach((batch, parentSku) => {
    const soldDemandBySku = childSoldDemandByParent.get(parentSku) ?? new Map();
    const reservedDemandBySku =
      childReservedDemandByParent.get(parentSku) ?? new Map();
    const activeDemandBySku = new Map<string, number>();

    batch.components.forEach((component) => {
      const normalizedChildSku = normalizeProductCode(component.componentSku);
      if (!normalizedChildSku) {
        return;
      }

      activeDemandBySku.set(
        normalizedChildSku,
        (soldDemandBySku.get(normalizedChildSku) ?? 0) +
          (reservedDemandBySku.get(normalizedChildSku) ?? 0)
      );
    });

    const soldOpenedSets = computeOpenedSetsForDemand(batch, soldDemandBySku);
    const totalOpenedSets = computeOpenedSetsForDemand(batch, activeDemandBySku);
    const reservedOpenedSets = Math.max(totalOpenedSets - soldOpenedSets, 0);

    const directParentReserved = directParentReservedBySku?.get(parentSku) ?? 0;
    const directParentSold = directParentSoldBySku?.get(parentSku) ?? 0;
    const parentOnHand = parentOnHandBySku?.get(parentSku);
    const remainingParentSets =
      parentOnHand === undefined
        ? null
        : Math.max(
            parentOnHand - directParentReserved - directParentSold - totalOpenedSets,
            0
          );

    const childLooseBySku = new Map<string, number>();
    const childAvailableBySku = new Map<string, number>();

    batch.components.forEach((component) => {
      const normalizedChildSku = normalizeProductCode(component.componentSku);
      if (!normalizedChildSku) {
        return;
      }

      const includedQuantity = Math.max(Number(component.includedQuantity) || 1, 1);
      const activeDemand = activeDemandBySku.get(normalizedChildSku) ?? 0;
      const loose = Math.max(totalOpenedSets * includedQuantity - activeDemand, 0);
      childLooseBySku.set(normalizedChildSku, loose);

      if (remainingParentSets !== null) {
        childAvailableBySku.set(
          normalizedChildSku,
          loose + remainingParentSets * includedQuantity
        );
      }
    });

    allocations.set(parentSku, {
      parentSku,
      soldOpenedSets,
      reservedOpenedSets,
      totalOpenedSets,
      remainingParentSets,
      childRevenue: childRevenueByParent.get(parentSku) ?? 0,
      childLooseBySku,
      childAvailableBySku,
      childSoldDemandBySku: soldDemandBySku,
      childReservedDemandBySku: reservedDemandBySku,
      childActiveDemandBySku: activeDemandBySku,
    });
  });

  return allocations;
}