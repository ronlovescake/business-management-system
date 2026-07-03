import type { Prisma, Transaction } from '@prisma/client';
import { isFulfilledStatus, isReservedStatus } from '@/lib/inventory/statuses';
import { normalizeOrderStatus } from '@/lib/transactions/order-status';
import {
  buildSellableDeltaMap,
  buildSellableReceiptCodeSet,
  getSellableOnHand,
} from '@/lib/inventory/movements';
import { allocateByAvailability } from '@/modules/clothing/operations/products/lib/mixAndMatchAllocation';
import { MIX_AND_MATCH_NAME_PREFIX } from '@/lib/inventory/mixAndMatchTag';
import { findSplitBatchByChildSkuTx } from '@/lib/inventory/splitLookup';
import type { TransactionUpdateRecord } from './sanitizers';
import {
  computeRemainingBalance,
  type ExistingTransactionForPaidStatusCheck,
} from './service-calculations';
import {
  buildAutoMixReserveMovementNote,
  buildAutoMixReserveMovementPrefix,
  buildAutoMixSaleMovementNote,
  buildAutoMixSaleMovementPrefix,
  buildAutoReserveMovementNote,
  buildAutoSaleMovementNote,
  normalizeProductCode,
} from './inventoryMovementNotes';
import {
  findLatestAutoMovement,
  setAutoMovementActive,
  setAutoMovementInactive,
  setAutoMovementsInactiveByPrefix,
  type AutoMovementRecord,
} from './movementStateHelpers';
import { TransactionValidationError } from './referenceValidation';

const WAREHOUSE_SHIPMENT_STATUSES = new Set([
  'for pickup',
  'sorting',
  'delivered',
]);

type TransactionClientLike = Prisma.TransactionClient;

type MixAndMatchDefinition = {
  id: number;
  components: Array<{ componentProductCode: string }>;
};

type TransactionForInventorySync = Pick<
  Transaction,
  | 'id'
  | 'productCode'
  | 'quantity'
  | 'unitPrice'
  | 'discount'
  | 'lineTotal'
  | 'orderDate'
  | 'packedDate'
  | 'orderStatus'
  | 'adjustment'
>;

type ExistingAutoMovements = {
  reserve: AutoMovementRecord | null;
  sale: AutoMovementRecord | null;
};

type AutoMovementNotes = {
  reserve: string;
  sale: string;
  mixReservePrefix: string;
  mixSalePrefix: string;
};

type DerivedMovementState = {
  postingDate: string | null;
  reserved: boolean;
  fulfilled: boolean;
};

function buildAutoMovementNotes(transactionId: number): AutoMovementNotes {
  return {
    reserve: buildAutoReserveMovementNote(transactionId),
    sale: buildAutoSaleMovementNote(transactionId),
    mixReservePrefix: buildAutoMixReserveMovementPrefix(transactionId),
    mixSalePrefix: buildAutoMixSaleMovementPrefix(transactionId),
  };
}

async function findExistingAutoMovements(
  client: TransactionClientLike,
  notes: Pick<AutoMovementNotes, 'reserve' | 'sale'>
): Promise<ExistingAutoMovements> {
  const [reserve, sale] = await Promise.all([
    findLatestAutoMovement(client, notes.reserve),
    findLatestAutoMovement(client, notes.sale),
  ]);

  return { reserve, sale };
}

async function deactivateAllAutoMovements(
  client: TransactionClientLike,
  notes: AutoMovementNotes
) {
  await Promise.all([
    setAutoMovementInactive({ client, note: notes.reserve }),
    setAutoMovementInactive({ client, note: notes.sale }),
    setAutoMovementsInactiveByPrefix({
      client,
      notePrefix: notes.mixReservePrefix,
    }),
    setAutoMovementsInactiveByPrefix({
      client,
      notePrefix: notes.mixSalePrefix,
    }),
  ]);
}

async function deactivateMixAutoMovements(
  client: TransactionClientLike,
  notes: Pick<AutoMovementNotes, 'mixReservePrefix' | 'mixSalePrefix'>
) {
  await Promise.all([
    setAutoMovementsInactiveByPrefix({
      client,
      notePrefix: notes.mixReservePrefix,
    }),
    setAutoMovementsInactiveByPrefix({
      client,
      notePrefix: notes.mixSalePrefix,
    }),
  ]);
}

function deriveMovementState(
  transaction: TransactionForInventorySync
): DerivedMovementState {
  const postingDate = transaction.packedDate ?? transaction.orderDate ?? null;
  const reserved = isReservedStatus(transaction.orderStatus);
  const paidAmount = transaction.adjustment ?? 0;

  const remaining = computeRemainingBalance({
    lineTotal: transaction.lineTotal,
    quantity: transaction.quantity,
    unitPrice: transaction.unitPrice,
    discount: transaction.discount,
    adjustment: transaction.adjustment,
  });
  const fullyPaid = remaining <= 0.01;

  const treatedAsFulfilledBecausePaidAndPrepared =
    (transaction.orderStatus ?? '').trim().toLowerCase() === 'prepared' &&
    paidAmount > 0 &&
    fullyPaid;

  return {
    postingDate,
    reserved,
    fulfilled:
      isFulfilledStatus(transaction.orderStatus) ||
      treatedAsFulfilledBecausePaidAndPrepared,
  };
}

function getMixComponentCodes(mixAndMatch: MixAndMatchDefinition): string[] {
  return Array.from(
    new Set(
      mixAndMatch.components
        .map((component) => component.componentProductCode.trim())
        .filter(Boolean)
    )
  );
}

function buildAllocatedByCode(
  allocation: Array<{ key: string; allocated: number }>
) {
  const allocatedByCode = new Map<string, number>();
  allocation.forEach((item) => {
    allocatedByCode.set(item.key.toLowerCase(), Math.max(item.allocated, 0));
  });

  return allocatedByCode;
}

async function syncSimpleReserveAndSaleMovements(params: {
  client: TransactionClientLike;
  existingReserve: AutoMovementRecord | null;
  existingSale: AutoMovementRecord | null;
  productCode: string;
  quantity: number;
  postingDate: string | null;
  transactionId: number;
  reserveNote: string;
  saleNote: string;
  reserved: boolean;
  fulfilled: boolean;
}) {
  const {
    client,
    existingReserve,
    existingSale,
    productCode,
    quantity,
    postingDate,
    transactionId,
    reserveNote,
    saleNote,
    reserved,
    fulfilled,
  } = params;

  const shouldKeepReserveActive =
    reserved ||
    (fulfilled && Boolean(existingReserve && !existingReserve.deletedAt));

  if (shouldKeepReserveActive) {
    await setAutoMovementActive({
      client,
      existing: existingReserve,
      productCode,
      quantity,
      fromBucket: 'sellable',
      toBucket: 'reserved',
      postingDate,
      note: reserveNote,
      metadata: {
        sourceTransactionId: transactionId,
        movementSource: 'transaction',
        movementType: 'reserve',
      },
    });
  } else {
    await setAutoMovementInactive({ client, note: reserveNote });
  }

  if (fulfilled) {
    await setAutoMovementActive({
      client,
      existing: existingSale,
      productCode,
      quantity,
      fromBucket: shouldKeepReserveActive ? 'reserved' : 'sellable',
      toBucket: 'sold',
      postingDate,
      note: saleNote,
      metadata: {
        sourceTransactionId: transactionId,
        movementSource: 'transaction',
        movementType: 'sale',
      },
    });
  } else {
    await setAutoMovementInactive({ client, note: saleNote });
  }
}

async function syncAllocatedComponentMovements(params: {
  client: TransactionClientLike;
  transactionId: number;
  componentCode: string;
  allocated: number;
  postingDate: string | null;
  reserved: boolean;
  fulfilled: boolean;
}) {
  const {
    client,
    transactionId,
    componentCode,
    allocated,
    postingDate,
    reserved,
    fulfilled,
  } = params;

  const reserveNote = buildAutoMixReserveMovementNote(
    transactionId,
    componentCode
  );
  const saleNote = buildAutoMixSaleMovementNote(transactionId, componentCode);
  const existingMovements = await findExistingAutoMovements(client, {
    reserve: reserveNote,
    sale: saleNote,
  });

  await syncSimpleReserveAndSaleMovements({
    client,
    existingReserve: existingMovements.reserve,
    existingSale: existingMovements.sale,
    productCode: componentCode,
    quantity: allocated,
    postingDate,
    transactionId,
    reserveNote,
    saleNote,
    reserved,
    fulfilled,
  });
}

async function syncMixAndMatchMovements(params: {
  client: TransactionClientLike;
  transaction: TransactionForInventorySync;
  mixAndMatch: MixAndMatchDefinition;
  notes: AutoMovementNotes;
  state: DerivedMovementState;
}) {
  const { client, transaction, mixAndMatch, notes, state } = params;

  await Promise.all([
    setAutoMovementInactive({ client, note: notes.reserve }),
    setAutoMovementInactive({ client, note: notes.sale }),
  ]);

  const componentCodes = getMixComponentCodes(mixAndMatch);
  if (componentCodes.length === 0) {
    await deactivateMixAutoMovements(client, notes);
    return;
  }

  const availabilityByCode = await getMovementAdjustedAvailabilityByProduct(
    client,
    componentCodes
  );

  const allocatedByCode = buildAllocatedByCode(
    allocateByAvailability(
      componentCodes.map((code) => ({
        key: code,
        available: availabilityByCode.get(code.toLowerCase()) ?? 0,
      })),
      transaction.quantity ?? 0
    )
  );

  await deactivateMixAutoMovements(client, notes);

  for (const componentCode of componentCodes) {
    const allocated = allocatedByCode.get(componentCode.toLowerCase()) ?? 0;
    if (allocated <= 0) {
      continue;
    }

    await syncAllocatedComponentMovements({
      client,
      transactionId: transaction.id,
      componentCode,
      allocated,
      postingDate: state.postingDate,
      reserved: state.reserved,
      fulfilled: state.fulfilled,
    });
  }
}

async function resolveSimpleMovementProductCode(
  client: TransactionClientLike,
  productCode: string
) {
  const splitChild = await findSplitBatchByChildSkuTx(client, productCode);
  return splitChild?.parentSku ?? productCode;
}

export function assertCanSetPaidStatus(params: {
  nextStatus: string | null | undefined;
  existing: ExistingTransactionForPaidStatusCheck;
  updateValues: TransactionUpdateRecord['values'];
}) {
  const { nextStatus, existing, updateValues } = params;

  if (!isPaidStatus(nextStatus)) {
    return;
  }

  const remaining = computeRemainingBalance({
    lineTotal: updateValues['Line Total'],
    quantity: updateValues.Quantity ?? existing.quantity,
    unitPrice: updateValues['Unit Price'] ?? existing.unitPrice,
    discount: updateValues.Discount ?? existing.discount,
    adjustment: updateValues.Adjustment ?? existing.adjustment,
  });

  const EPS = 0.01;
  if (remaining > EPS) {
    throw new TransactionValidationError(
      `Cannot set Order Status to "${nextStatus}" while balance is unpaid (remaining: ${remaining.toFixed(
        2
      )}). Record full payment first, or use "Pending Payment" for shipped-but-unpaid orders.`
    );
  }
}

async function resolveLinkedShipmentStatus(params: {
  client: TransactionClientLike;
  productCode: string | null | undefined;
  shipmentCode: string | null | undefined;
}): Promise<string | null> {
  const { client } = params;
  const normalizedProductCode = (params.productCode ?? '').trim();
  const normalizedShipmentCode = (params.shipmentCode ?? '').trim();

  let fallbackShipmentCode = normalizedShipmentCode;

  if (normalizedProductCode) {
    const linkedProduct = await client.product.findFirst({
      where: {
        deletedAt: null,
        productCode: {
          equals: normalizedProductCode,
          mode: 'insensitive',
        },
      },
      select: {
        shipmentStatus: true,
        shipmentCode: true,
      },
    });

    const productShipmentStatus = (linkedProduct?.shipmentStatus ?? '').trim();
    if (productShipmentStatus) {
      return productShipmentStatus;
    }

    const productShipmentCode = (linkedProduct?.shipmentCode ?? '').trim();
    if (!fallbackShipmentCode && productShipmentCode) {
      fallbackShipmentCode = productShipmentCode;
    }
  }

  if (!fallbackShipmentCode) {
    return null;
  }

  const linkedShipment = await client.shipment.findFirst({
    where: {
      deletedAt: null,
      shipmentCode: {
        equals: fallbackShipmentCode,
        mode: 'insensitive',
      },
    },
    select: {
      shipmentStatus: true,
    },
  });

  const shipmentStatus = (linkedShipment?.shipmentStatus ?? '').trim();
  return shipmentStatus || null;
}

export async function assertOrderStatusNotBackwardToInTransit(params: {
  client: TransactionClientLike;
  nextStatus: string | null | undefined;
  productCode: string | null | undefined;
  shipmentCode: string | null | undefined;
}) {
  const { client, nextStatus, productCode, shipmentCode } = params;

  if (normalizeOrderStatus(nextStatus) !== 'in transit') {
    return;
  }

  const linkedShipmentStatus = await resolveLinkedShipmentStatus({
    client,
    productCode,
    shipmentCode,
  });

  if (!linkedShipmentStatus) {
    return;
  }

  const normalizedShipmentStatus = normalizeOrderStatus(linkedShipmentStatus);
  if (!WAREHOUSE_SHIPMENT_STATUSES.has(normalizedShipmentStatus)) {
    return;
  }

  throw new TransactionValidationError(
    `Cannot set Order Status to "In Transit" because linked shipment status is "${linkedShipmentStatus}". Shipment statuses For Pickup, Sorting, and Delivered must stay at least "Warehouse".`
  );
}

async function findMixAndMatchBySku(
  client: TransactionClientLike,
  productCode: string
): Promise<MixAndMatchDefinition | null> {
  return client.bundleBatch.findFirst({
    where: {
      bundleName: {
        startsWith: MIX_AND_MATCH_NAME_PREFIX,
      },
      bundleSku: {
        equals: productCode,
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
      components: {
        select: {
          componentProductCode: true,
        },
      },
    },
  });
}

async function getMovementAdjustedAvailabilityByProduct(
  client: TransactionClientLike,
  productCodes: string[]
) {
  const uniqueCodes = Array.from(
    new Set(productCodes.map((code) => (code ?? '').trim()).filter(Boolean))
  );

  const movements = await client.inventoryMovement.findMany({
    where: {
      deletedAt: null,
      productCode: { in: uniqueCodes },
    },
    select: {
      productCode: true,
      quantity: true,
      fromBucket: true,
      toBucket: true,
    },
  });

  const products = await client.product.findMany({
    where: { productCode: { in: uniqueCodes } },
    select: {
      productCode: true,
      quantity: true,
    },
  });

  const productQuantityMap = new Map<string, number>();
  products.forEach((product) => {
    const code = (product.productCode ?? '').trim();
    if (!code) {
      return;
    }

    productQuantityMap.set(code.toLowerCase(), product.quantity ?? 0);
  });

  const relevantMovements = movements.filter(
    (movement) => movement.toBucket !== 'supplier_short'
  );

  const sellableDeltaByProduct = buildSellableDeltaMap(relevantMovements);
  const sellableReceiptCodes = buildSellableReceiptCodeSet(relevantMovements);

  const availabilityMap = new Map<string, number>();
  uniqueCodes.forEach((code) => {
    const onHand = getSellableOnHand({
      productCode: code,
      sellableDeltaByProduct,
      fallbackQuantity: productQuantityMap.get(code.toLowerCase()) ?? 0,
      sellableReceiptCodes,
    });

    availabilityMap.set(code.toLowerCase(), Math.max(onHand, 0));
  });

  return availabilityMap;
}

export async function syncInventoryMovementsForTransaction(
  client: TransactionClientLike,
  transaction: TransactionForInventorySync
) {
  const productCode = normalizeProductCode(transaction.productCode);
  const quantity = transaction.quantity ?? 0;

  const notes = buildAutoMovementNotes(transaction.id);
  const existingMovements = await findExistingAutoMovements(client, notes);

  if (!productCode || quantity <= 0) {
    await deactivateAllAutoMovements(client, notes);
    return;
  }

  const movementState = deriveMovementState(transaction);

  const mixAndMatch = await findMixAndMatchBySku(client, productCode);
  if (mixAndMatch?.components?.length) {
    await syncMixAndMatchMovements({
      client,
      transaction,
      mixAndMatch,
      notes,
      state: movementState,
    });
    return;
  }

  const simpleMovementProductCode = await resolveSimpleMovementProductCode(
    client,
    productCode
  );

  await deactivateMixAutoMovements(client, notes);

  await syncSimpleReserveAndSaleMovements({
    client,
    existingReserve: existingMovements.reserve,
    existingSale: existingMovements.sale,
    productCode: simpleMovementProductCode,
    quantity,
    postingDate: movementState.postingDate,
    transactionId: transaction.id,
    reserveNote: notes.reserve,
    saleNote: notes.sale,
    reserved: movementState.reserved,
    fulfilled: movementState.fulfilled,
  });
}

function isPaidStatus(status: string | null | undefined) {
  const normalized = (status ?? '').trim().toLowerCase();
  return normalized === 'paid' || normalized === 'ready for dispatch';
}
