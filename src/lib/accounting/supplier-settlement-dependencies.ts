import type { Prisma } from '@prisma/client';

export async function hasSupplierSettlementForTransitKeys(
  client: Pick<Prisma.TransactionClient, 'clothingAccountingJournalLine'> &
    Partial<
      Pick<Prisma.TransactionClient, 'clothingSupplierCreditApplication'>
    >,
  keys: string[]
): Promise<boolean> {
  const productIds = keys.flatMap((key) => {
    const match = /^PRODUCT_TRANSIT_BUILD:(\d+):/.exec(key);
    return match ? [match[1]] : [];
  });
  if (productIds.length === 0) {
    return false;
  }
  return (
    (await client.clothingAccountingJournalLine.count({
      where: {
        deletedAt: null,
        sourceType: 'PRODUCT',
        sourceId: { in: productIds },
        OR: [
          { sourceLineKey: { startsWith: 'SUPPLIER_SETTLEMENT:' } },
          { sourceLineKey: { startsWith: 'SUPPLIER_CREDIT:' } },
        ],
      },
    })) > 0 ||
    ((await client.clothingSupplierCreditApplication?.count({
      where: { targetProductId: { in: productIds.map(Number) } },
    })) ?? 0) > 0
  );
}
