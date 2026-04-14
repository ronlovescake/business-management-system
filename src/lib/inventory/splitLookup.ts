import { prisma } from '@/lib/db';

export type SplitChildLookupResult = {
  splitBatchId: number;
  parentSku: string;
  componentLabel: string;
  componentSku: string;
  includedQuantity: number;
};

/**
 * Look up whether a product code is a split-child SKU.
 * Returns the parent's split batch info if found, or null.
 */
export async function findSplitBatchByChildSku(
  productCode: string
): Promise<SplitChildLookupResult | null> {
  const trimmed = productCode.trim();
  if (!trimmed) {
    return null;
  }

  const component = await prisma.splitBatchComponent.findFirst({
    where: {
      componentSku: {
        equals: trimmed,
        mode: 'insensitive',
      },
    },
    include: {
      splitBatch: {
        select: {
          id: true,
          splitSku: true,
        },
      },
    },
  });

  if (!component) {
    return null;
  }

  return {
    splitBatchId: component.splitBatch.id,
    parentSku: component.splitBatch.splitSku,
    componentLabel: component.componentLabel,
    componentSku: component.componentSku,
    includedQuantity: component.includedQuantity,
  };
}

/**
 * Prisma transaction-compatible version of findSplitBatchByChildSku.
 */
export async function findSplitBatchByChildSkuTx(
  client: { splitBatchComponent: typeof prisma.splitBatchComponent },
  productCode: string
): Promise<SplitChildLookupResult | null> {
  const trimmed = productCode.trim();
  if (!trimmed) {
    return null;
  }

  const component = await client.splitBatchComponent.findFirst({
    where: {
      componentSku: {
        equals: trimmed,
        mode: 'insensitive',
      },
    },
    include: {
      splitBatch: {
        select: {
          id: true,
          splitSku: true,
        },
      },
    },
  });

  if (!component) {
    return null;
  }

  return {
    splitBatchId: component.splitBatch.id,
    parentSku: component.splitBatch.splitSku,
    componentLabel: component.componentLabel,
    componentSku: component.componentSku,
    includedQuantity: component.includedQuantity,
  };
}
