import type { Prisma, PrismaClient } from '@prisma/client';

export type AutoMovementRecord = {
  id: number;
  deletedAt: Date | null;
};

export type AutoMovementMetadata = {
  sourceTransactionId: number;
  movementSource: 'transaction';
  movementType: 'reserve' | 'sale';
};

export async function logStatusChange(
  client: Prisma.TransactionClient | PrismaClient,
  transactionId: number,
  previousStatus: string | null | undefined,
  newStatus: string | null | undefined
): Promise<void> {
  const prev = previousStatus ?? null;
  const next = newStatus ?? null;

  if (prev === next) {
    return;
  }

  await client.transactionStatusChange.create({
    data: {
      transactionId,
      previousStatus: prev,
      newStatus: next,
    },
  });
}

export async function findLatestAutoMovement(
  client: Prisma.TransactionClient | PrismaClient,
  note: string
): Promise<AutoMovementRecord | null> {
  return client.inventoryMovement.findFirst({
    where: { notes: note },
    orderBy: { createdAt: 'desc' },
    select: { id: true, deletedAt: true },
  });
}

export async function setAutoMovementActive(params: {
  client: Prisma.TransactionClient | PrismaClient;
  existing: AutoMovementRecord | null;
  productCode: string;
  quantity: number;
  fromBucket: Prisma.InventoryMovementCreateInput['fromBucket'];
  toBucket: Prisma.InventoryMovementCreateInput['toBucket'];
  postingDate: string | null;
  note: string;
  metadata: AutoMovementMetadata;
}): Promise<void> {
  const {
    client,
    existing,
    productCode,
    quantity,
    fromBucket,
    toBucket,
    postingDate,
    note,
    metadata,
  } = params;

  const now = new Date();

  let activeId: number | null = null;

  if (existing) {
    await client.inventoryMovement.update({
      where: { id: existing.id },
      data: {
        deletedAt: null,
        productCode,
        quantity,
        fromBucket,
        toBucket,
        postingDate,
        notes: note,
        sourceTransactionId: metadata.sourceTransactionId,
        movementSource: metadata.movementSource,
        movementType: metadata.movementType,
      },
    });

    activeId = existing.id;
  } else {
    const created = await client.inventoryMovement.create({
      data: {
        productCode,
        quantity,
        fromBucket,
        toBucket,
        postingDate,
        notes: note,
        sourceTransactionId: metadata.sourceTransactionId,
        movementSource: metadata.movementSource,
        movementType: metadata.movementType,
      },
      select: { id: true },
    });

    activeId = created.id;
  }

  if (activeId) {
    await client.inventoryMovement.updateMany({
      where: {
        notes: note,
        deletedAt: null,
        NOT: { id: activeId },
      },
      data: { deletedAt: now },
    });
    return;
  }
}

export async function setAutoMovementInactive(params: {
  client: Prisma.TransactionClient | PrismaClient;
  note: string;
}): Promise<void> {
  const { client, note } = params;
  await client.inventoryMovement.updateMany({
    where: { notes: note, deletedAt: null },
    data: { deletedAt: new Date() },
  });
}

export async function setAutoMovementsInactiveByPrefix(params: {
  client: Prisma.TransactionClient | PrismaClient;
  notePrefix: string;
}): Promise<void> {
  const { client, notePrefix } = params;
  await client.inventoryMovement.updateMany({
    where: {
      notes: { startsWith: notePrefix },
      deletedAt: null,
    },
    data: { deletedAt: new Date() },
  });
}
