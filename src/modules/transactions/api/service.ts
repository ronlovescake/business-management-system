import type { Prisma, Transaction } from '@prisma/client';
import type { ChangeLogEntryInput } from '@/core/change-log';
import { prisma } from '@/lib/db';
import { isFulfilledStatus, isReservedStatus } from '@/lib/inventory/statuses';
import { normalizeOrderStatus } from '@/lib/transactions/order-status';
import {
  buildSellableDeltaMap,
  buildSellableReceiptCodeSet,
  getSellableOnHand,
} from '@/lib/inventory/movements';
import { allocateByAvailability } from '@/modules/clothing/operations/products/lib/mixAndMatchAllocation';
import { MIX_AND_MATCH_NAME_PREFIX } from '@/lib/inventory/mixAndMatchTag';
import { logger } from '@/lib/logger';
import type { TransactionDTO } from './dto';
import { mapToDTO } from './dto';
import {
  EMPTY_SHIPMENT_MARKER,
  isEmptyRow,
  isTemplatePreparedRow,
  isValidRow,
  sanitizeTransactionRecord,
  sanitizeTransactionUpdateRecord,
} from './sanitizers';
import type { TransactionUpdateRecord } from './sanitizers';
import {
  computeLineTotalForUpdate,
  computeRemainingBalance,
  isPaidStatus,
  type ExistingTransactionForPaidStatusCheck,
} from './service-calculations';
import { transactionDataSchema, transactionUpdateSchema } from './schemas';
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
  buildUpdatePayload,
  describeChange,
  mapFieldName,
  shouldRecalculateLineTotal,
} from './updateHelpers';
import { buildCreateInput } from './createInputHelpers';
import {
  logImportChange,
  logOperationNotification,
  logUpdateChanges,
} from './auditLogHelpers';
import {
  findLatestAutoMovement,
  logStatusChange,
  setAutoMovementActive,
  setAutoMovementInactive,
  setAutoMovementsInactiveByPrefix,
} from './movementStateHelpers';
import {
  buildTransactionUpdateMessage,
  fetchExistingTransaction,
} from './runtimeHelpers';

interface TransactionImportSummary {
  count: number;
  withData: number;
  empty: number;
}

interface TransactionUpdateSummary {
  count: number;
}

interface TransactionUpdateResult {
  transaction: TransactionDTO;
}

export class TransactionReferenceError extends Error {
  constructor(
    message: string,
    public details: {
      missing: {
        customers: string[];
        products: string[];
        shipments: string[];
      };
      counts: {
        customers: number;
        products: number;
        shipments: number;
      };
      suggestion: string;
    }
  ) {
    super(message);
  }
}

export class TransactionValidationError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class TransactionNotFoundError extends Error {
  constructor(message: string) {
    super(message);
  }
}

async function validateReferences(rows: Prisma.TransactionCreateManyInput[]) {
  const uniqueCustomers = Array.from(
    new Set(rows.map((t) => t.customers).filter((c): c is string => Boolean(c)))
  );
  const uniqueProducts = Array.from(
    new Set(
      rows.map((t) => t.productCode).filter((p): p is string => Boolean(p))
    )
  );
  const uniqueShipments = Array.from(
    new Set(
      rows
        .map((t) => t.shipmentCode)
        .filter((s): s is string => Boolean(s) && s !== EMPTY_SHIPMENT_MARKER)
    )
  );

  const existingCustomers = await prisma.customer.findMany({
    where: { customerName: { in: uniqueCustomers } },
    select: { customerName: true },
  });
  const existingCustomerNames = new Set(
    existingCustomers.map((c) => c.customerName)
  );
  const missingCustomers = uniqueCustomers.filter(
    (name) => !existingCustomerNames.has(name)
  );

  const existingProducts = await prisma.product.findMany({
    where: { productCode: { in: uniqueProducts } },
    select: { productCode: true },
  });

  // Bundles are valid sale SKUs but do not exist in `products`.
  // Treat any BundleBatch.bundleSku as a valid "product" reference.
  const existingBundleSkus =
    uniqueProducts.length === 0
      ? []
      : await prisma.bundleBatch.findMany({
          where: {
            OR: uniqueProducts.map((code) => ({
              bundleSku: { equals: code, mode: 'insensitive' as const },
            })),
          },
          select: { bundleSku: true },
        });

  const existingProductCodeSet = new Set<string>();
  existingProducts
    .map((p) => p.productCode)
    .filter((code): code is string => Boolean(code))
    .forEach((code) => existingProductCodeSet.add(code.toLowerCase()));

  existingBundleSkus
    .map((b) => b.bundleSku)
    .filter((code): code is string => Boolean(code))
    .forEach((code) => existingProductCodeSet.add(code.toLowerCase()));

  const missingProducts = uniqueProducts.filter(
    (code) => !existingProductCodeSet.has(code.toLowerCase())
  );

  let missingShipments: string[] = [];
  if (uniqueShipments.length > 0) {
    const existingShipments = await prisma.shipment.findMany({
      where: { shipmentCode: { in: uniqueShipments } },
      select: { shipmentCode: true },
    });
    const existingShipmentCodes = new Set(
      existingShipments.map((s) => s.shipmentCode)
    );
    missingShipments = uniqueShipments.filter(
      (code) => !existingShipmentCodes.has(code)
    );
  }

  if (
    missingCustomers.length > 0 ||
    missingProducts.length > 0 ||
    missingShipments.length > 0
  ) {
    throw new TransactionReferenceError('Reference integrity violation', {
      missing: {
        customers: missingCustomers.slice(0, 10),
        products: missingProducts.slice(0, 10),
        shipments: missingShipments.slice(0, 10),
      },
      counts: {
        customers: missingCustomers.length,
        products: missingProducts.length,
        shipments: missingShipments.length,
      },
      suggestion:
        'Import the missing entities first, then retry the transaction import.',
    });
  }
}

// =============================================================================
// ⚠️ LINE TOTAL RECALC (UPDATE PATH)
// =============================================================================
// Line Total must stay aligned with Quantity × Unit Price - Adjustment on
// *updates*, even when users do not explicitly edit Line Total.
// =============================================================================
function assertCanSetPaidStatus(params: {
  nextStatus: string | null | undefined;
  existing: ExistingTransactionForPaidStatusCheck;
  updateValues: TransactionUpdateRecord['values'];
}) {
  const { nextStatus, existing, updateValues } = params;

  if (!isPaidStatus(nextStatus)) {
    return;
  }

  // ========================================================================
  // ⚠️ PAID STATUS GUARD
  // ========================================================================
  // If a paid status is set, ensure the remaining balance is fully settled
  // using updated inputs (line total will be recalculated on save).
  // ========================================================================
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

const WAREHOUSE_SHIPMENT_STATUSES = new Set([
  'for pickup',
  'sorting',
  'delivered',
]);

async function resolveLinkedShipmentStatus(params: {
  client: Prisma.TransactionClient | typeof prisma;
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

async function assertOrderStatusNotBackwardToInTransit(params: {
  client: Prisma.TransactionClient | typeof prisma;
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

async function findMixAndMatchBySku(
  client: Prisma.TransactionClient | typeof prisma,
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
  client: Prisma.TransactionClient | typeof prisma,
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

async function syncInventoryMovementsForTransaction(
  client: Prisma.TransactionClient | typeof prisma,
  transaction: TransactionForInventorySync
) {
  const productCode = normalizeProductCode(transaction.productCode);
  const quantity = transaction.quantity ?? 0;

  const reserveNote = buildAutoReserveMovementNote(transaction.id);
  const saleNote = buildAutoSaleMovementNote(transaction.id);
  const mixReservePrefix = buildAutoMixReserveMovementPrefix(transaction.id);
  const mixSalePrefix = buildAutoMixSaleMovementPrefix(transaction.id);

  const [existingReserve, existingSale] = await Promise.all([
    findLatestAutoMovement(client, reserveNote),
    findLatestAutoMovement(client, saleNote),
  ]);

  // If SKU/qty is invalid, ensure our auto-movements are inactive.
  if (!productCode || quantity <= 0) {
    await Promise.all([
      setAutoMovementInactive({ client, note: reserveNote }),
      setAutoMovementInactive({ client, note: saleNote }),
      setAutoMovementsInactiveByPrefix({
        client,
        notePrefix: mixReservePrefix,
      }),
      setAutoMovementsInactiveByPrefix({
        client,
        notePrefix: mixSalePrefix,
      }),
    ]);
    return;
  }

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

  // Ops workflow: "Ready For Dispatch" / "Checked Out" implies shipped the same day.
  // This is why we treat fulfilled statuses as the trigger to create the sale movement
  // (.. -> sold), which in turn drives COGS recognition in accounting.
  const fulfilled =
    isFulfilledStatus(transaction.orderStatus) ||
    treatedAsFulfilledBecausePaidAndPrepared;

  const mixAndMatch = await findMixAndMatchBySku(client, productCode);
  const isMixAndMatch = Boolean(mixAndMatch?.components?.length);

  if (isMixAndMatch) {
    await Promise.all([
      setAutoMovementInactive({ client, note: reserveNote }),
      setAutoMovementInactive({ client, note: saleNote }),
    ]);

    const componentCodes = Array.from(
      new Set(
        (mixAndMatch?.components ?? [])
          .map((component) => component.componentProductCode.trim())
          .filter(Boolean)
      )
    );

    if (componentCodes.length === 0) {
      await Promise.all([
        setAutoMovementsInactiveByPrefix({
          client,
          notePrefix: mixReservePrefix,
        }),
        setAutoMovementsInactiveByPrefix({
          client,
          notePrefix: mixSalePrefix,
        }),
      ]);
      return;
    }

    const availabilityByCode = await getMovementAdjustedAvailabilityByProduct(
      client,
      componentCodes
    );

    const allocation = allocateByAvailability(
      componentCodes.map((code) => ({
        key: code,
        available: availabilityByCode.get(code.toLowerCase()) ?? 0,
      })),
      quantity
    );

    const allocatedByCode = new Map<string, number>();
    allocation.forEach((item) => {
      allocatedByCode.set(item.key.toLowerCase(), Math.max(item.allocated, 0));
    });

    await Promise.all([
      setAutoMovementsInactiveByPrefix({
        client,
        notePrefix: mixReservePrefix,
      }),
      setAutoMovementsInactiveByPrefix({
        client,
        notePrefix: mixSalePrefix,
      }),
    ]);

    for (const componentCode of componentCodes) {
      const allocated = allocatedByCode.get(componentCode.toLowerCase()) ?? 0;
      if (allocated <= 0) {
        continue;
      }

      const reserveNoteForComponent = buildAutoMixReserveMovementNote(
        transaction.id,
        componentCode
      );
      const saleNoteForComponent = buildAutoMixSaleMovementNote(
        transaction.id,
        componentCode
      );

      const [existingComponentReserve, existingComponentSale] =
        await Promise.all([
          findLatestAutoMovement(client, reserveNoteForComponent),
          findLatestAutoMovement(client, saleNoteForComponent),
        ]);

      const shouldKeepReserveActive =
        reserved ||
        (fulfilled &&
          Boolean(
            existingComponentReserve && !existingComponentReserve.deletedAt
          ));

      if (shouldKeepReserveActive) {
        await setAutoMovementActive({
          client,
          existing: existingComponentReserve,
          productCode: componentCode,
          quantity: allocated,
          fromBucket: 'sellable',
          toBucket: 'reserved',
          postingDate,
          note: reserveNoteForComponent,
        });
      } else {
        await setAutoMovementInactive({
          client,
          note: reserveNoteForComponent,
        });
      }

      if (fulfilled) {
        await setAutoMovementActive({
          client,
          existing: existingComponentSale,
          productCode: componentCode,
          quantity: allocated,
          fromBucket: shouldKeepReserveActive ? 'reserved' : 'sellable',
          toBucket: 'sold',
          postingDate,
          note: saleNoteForComponent,
        });
      } else {
        await setAutoMovementInactive({
          client,
          note: saleNoteForComponent,
        });
      }
    }

    return;
  }

  await Promise.all([
    setAutoMovementsInactiveByPrefix({ client, notePrefix: mixReservePrefix }),
    setAutoMovementsInactiveByPrefix({ client, notePrefix: mixSalePrefix }),
  ]);

  // Reservation movement:
  // - Active while reserved
  // - Also stays active if it was already active and the transaction becomes fulfilled
  //   (so the path can be: sellable -> reserved -> sold)
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
    });
  } else {
    await setAutoMovementInactive({ client, note: reserveNote });
  }

  const reserveIsActive = shouldKeepReserveActive;

  // Sale movement:
  // - Active while fulfilled
  // - If reservation exists and is active, sell from reserved -> sold
  //   otherwise sell from sellable -> sold
  if (fulfilled) {
    await setAutoMovementActive({
      client,
      existing: existingSale,
      productCode,
      quantity,
      fromBucket: reserveIsActive ? 'reserved' : 'sellable',
      toBucket: 'sold',
      postingDate,
      note: saleNote,
    });
  } else {
    await setAutoMovementInactive({ client, note: saleNote });
  }
}

async function handleNotificationBatch(
  updates: Array<{ id: number; transaction: Transaction; changes: string[] }>
) {
  if (updates.length === 0) {
    return;
  }

  await Promise.all(
    updates.map(async ({ id, transaction, changes }) => {
      const message = buildTransactionUpdateMessage({
        id,
        transaction,
        changes,
      });

      await logOperationNotification('transactions', message, {
        transactionId: id,
      });
    })
  );
}

export interface TransactionService {
  findActive: () => Promise<TransactionDTO[]>;
  importTransactions: (payload: unknown[]) => Promise<TransactionImportSummary>;
  bulkUpdateTransactions: (
    payload: unknown[]
  ) => Promise<TransactionUpdateSummary>;
  updateTransaction: (payload: unknown) => Promise<TransactionUpdateResult>;
  softDeleteAll: () => Promise<{ deleted: number; alreadyDeleted: number }>;
}

export const transactionService: TransactionService = {
  async findActive() {
    const transactions = await prisma.transaction.findMany({
      where: { deletedAt: null },
      orderBy: { id: 'asc' },
    });
    return transactions.map(mapToDTO);
  },

  async importTransactions(payload) {
    if (!Array.isArray(payload)) {
      throw new TransactionValidationError('Invalid data format');
    }

    const normalized = payload.map((entry, index) => ({
      index,
      record: sanitizeTransactionRecord(entry),
    }));

    const priceTiers = await prisma.price.findMany({
      select: {
        productCode: true,
        lowerLimit: true,
        upperLimit: true,
        currentPrice: true,
      },
    });

    const emptyRows = normalized.filter(({ record }) => isEmptyRow(record));
    const validRows = normalized.filter(({ record }) => isValidRow(record));

    const preparedRows: Prisma.TransactionCreateManyInput[] = [];
    let skippedTemplateRows = 0;

    for (const { record, index } of validRows) {
      const validation = transactionDataSchema.safeParse(record);
      if (!validation.success) {
        logger.warn(`Transaction #${index + 1} skipped - validation failed`, {
          row: index + 1,
          issues: validation.error.issues,
        });
        continue;
      }

      if (isTemplatePreparedRow(validation.data)) {
        skippedTemplateRows += 1;
        logger.warn(
          `Transaction #${index + 1} skipped - template row detected`,
          {
            row: index + 1,
          }
        );
        continue;
      }

      await assertOrderStatusNotBackwardToInTransit({
        client: prisma,
        nextStatus: validation.data['Order Status'],
        productCode: validation.data['Product Code'],
        shipmentCode: validation.data['Shipment Code'],
      });

      preparedRows.push(buildCreateInput(validation.data, priceTiers));
    }

    const skippedEmptyRows = emptyRows.length;
    const allRows = preparedRows;

    if (allRows.length === 0) {
      throw new TransactionValidationError(
        'No valid transactions to import. Please review the CSV file.'
      );
    }

    await validateReferences(allRows);

    const importStartedAt = new Date();
    const result = await prisma.transaction.createMany({ data: allRows });

    // createMany does not return created IDs; re-query recent rows and post
    // reservation/sale movements based on their initial status.
    const createdTransactions = await prisma.transaction.findMany({
      where: {
        deletedAt: null,
        createdAt: { gte: importStartedAt },
      },
      select: {
        id: true,
        productCode: true,
        quantity: true,
        unitPrice: true,
        discount: true,
        lineTotal: true,
        orderDate: true,
        packedDate: true,
        orderStatus: true,
        adjustment: true,
      },
    });

    const needsMovementSync = createdTransactions.filter(
      (tx) =>
        isReservedStatus(tx.orderStatus) || isFulfilledStatus(tx.orderStatus)
    );

    if (needsMovementSync.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (const created of needsMovementSync) {
          await syncInventoryMovementsForTransaction(tx, created);
        }
      });
    }

    const summaryMessage = `Imported ${result.count} transaction records (${preparedRows.length} with data, ${skippedEmptyRows} empty rows skipped${skippedTemplateRows ? `, ${skippedTemplateRows} template rows skipped` : ''})`;

    await logOperationNotification('transactions', summaryMessage, {
      count: result.count,
      withData: preparedRows.length,
      empty: skippedEmptyRows,
      templateSkipped: skippedTemplateRows,
    });

    await logImportChange(
      result.count,
      preparedRows.length,
      skippedEmptyRows,
      skippedTemplateRows
    );

    return {
      count: result.count,
      withData: preparedRows.length,
      empty: skippedEmptyRows,
    };
  },

  async bulkUpdateTransactions(payload) {
    if (!Array.isArray(payload)) {
      throw new TransactionValidationError('Invalid data format');
    }

    let updates: TransactionUpdateRecord[];
    try {
      updates = payload.map((entry) => sanitizeTransactionUpdateRecord(entry));
    } catch (error) {
      throw new TransactionValidationError(
        error instanceof Error ? error.message : 'Invalid transaction payload'
      );
    }

    const changeLogEntries: ChangeLogEntryInput[] = [];

    const results = await prisma.$transaction(async (tx) => {
      // IMPORTANT:
      // Avoid running many updates concurrently inside an interactive
      // transaction. If any single update fails, Prisma rolls back the
      // transaction and any in-flight queries will start throwing P2028
      // ("Transaction already closed"), creating log spam.
      const updateResults: Array<{
        id: number;
        transaction: Transaction;
        changes: string[];
      }> = [];

      for (const update of updates) {
        const id = update.id;
        const existing = await fetchExistingTransaction(tx.transaction, id);
        if (!existing) {
          throw new TransactionNotFoundError(`Transaction ${id} not found`);
        }

        const validation = transactionUpdateSchema.safeParse({
          ...update.values,
          id,
        });
        if (!validation.success) {
          throw new TransactionValidationError('Validation failed');
        }

        const dbData = buildUpdatePayload(update.values);
        // ==================================================================
        // ⚠️ AUTO LINE TOTAL UPDATE
        // ==================================================================
        // Keep line total consistent with operational inputs when Quantity,
        // Unit Price, or Adjustment changes during bulk updates.
        // ==================================================================
        const recalcLineTotal = shouldRecalculateLineTotal(update.values);
        const computedLineTotal = recalcLineTotal
          ? computeLineTotalForUpdate({
              existing,
              updateValues: update.values,
            })
          : existing.lineTotal;

        if (recalcLineTotal) {
          dbData.lineTotal = computedLineTotal;
        }

        if (update.values['Order Status'] !== undefined) {
          assertCanSetPaidStatus({
            nextStatus: update.values['Order Status'],
            existing,
            updateValues: update.values,
          });

          await assertOrderStatusNotBackwardToInTransit({
            client: tx,
            nextStatus: update.values['Order Status'],
            productCode: update.values['Product Code'] ?? existing.productCode,
            shipmentCode:
              update.values['Shipment Code'] ?? existing.shipmentCode,
          });
        }

        const changes: string[] = [];

        if (update.values['Order Date'] !== undefined) {
          const newValue = update.values['Order Date'] ?? '';
          if ((existing.orderDate || '') !== newValue) {
            changes.push(
              describeChange('orderDate', existing.orderDate, newValue)
            );
          }
        }
        if (update.values.Customers !== undefined) {
          const newValue = update.values.Customers ?? '';
          if ((existing.customers || '') !== newValue) {
            changes.push(
              describeChange('customers', existing.customers, newValue)
            );
          }
        }
        if (update.values['Product Code'] !== undefined) {
          const newValue = update.values['Product Code'] ?? '';
          if ((existing.productCode || '') !== newValue) {
            changes.push(
              describeChange('productCode', existing.productCode, newValue)
            );
          }
        }
        if (update.values.Quantity !== undefined) {
          const newValue = update.values.Quantity;
          if ((existing.quantity ?? 0) !== newValue) {
            changes.push(
              describeChange('quantity', existing.quantity, newValue)
            );
          }
        }
        if (update.values['Unit Price'] !== undefined) {
          const newValue = update.values['Unit Price'];
          if ((existing.unitPrice ?? 0) !== newValue) {
            changes.push(
              describeChange('unitPrice', existing.unitPrice, newValue)
            );
          }
        }
        if (update.values.Discount !== undefined) {
          const newValue = update.values.Discount;
          if ((existing.discount ?? 0) !== newValue) {
            changes.push(
              describeChange('discount', existing.discount, newValue)
            );
          }
        }
        if (update.values.Adjustment !== undefined) {
          const newValue = update.values.Adjustment;
          if ((existing.adjustment ?? 0) !== newValue) {
            changes.push(
              describeChange('adjustment', existing.adjustment, newValue)
            );
          }
        }
        if (recalcLineTotal) {
          if ((existing.lineTotal ?? 0) !== computedLineTotal) {
            changes.push(
              describeChange('lineTotal', existing.lineTotal, computedLineTotal)
            );
          }
        }
        if (update.values['Order Status'] !== undefined) {
          const newValue = update.values['Order Status'] ?? '';
          if ((existing.orderStatus || '') !== newValue) {
            changes.push(
              describeChange('orderStatus', existing.orderStatus, newValue)
            );
          }
        }
        if (update.values.Notes !== undefined) {
          const newValue = update.values.Notes ?? null;
          if ((existing.notes ?? null) !== newValue) {
            changes.push(describeChange('notes', existing.notes, newValue));
          }
        }
        if (update.values['Invoice Date'] !== undefined) {
          const newValue = update.values['Invoice Date'] ?? null;
          if ((existing.invoiceDate ?? null) !== newValue) {
            changes.push(
              describeChange('invoiceDate', existing.invoiceDate, newValue)
            );
          }
        }
        if (update.values['Packed Date'] !== undefined) {
          const newValue = update.values['Packed Date'] ?? null;
          if ((existing.packedDate ?? null) !== newValue) {
            changes.push(
              describeChange('packedDate', existing.packedDate, newValue)
            );
          }
        }
        if (update.values['Shipment Code'] !== undefined) {
          const newValue = update.values['Shipment Code'] ?? null;
          if ((existing.shipmentCode ?? null) !== newValue) {
            changes.push(
              describeChange('shipmentCode', existing.shipmentCode, newValue)
            );
          }
        }

        const updated = await tx.transaction.update({
          where: { id },
          data: dbData,
        });

        await logStatusChange(
          tx,
          id,
          existing.orderStatus,
          updated.orderStatus
        );
        await syncInventoryMovementsForTransaction(tx, updated);

        if (changes.length > 0) {
          changeLogEntries.push({
            entityType: 'transaction',
            entityId: id,
            action: 'update',
            oldValue: existing,
            newValue: updated,
          });
        }

        updateResults.push({
          id,
          transaction: updated,
          changes,
        });
      }

      return updateResults;
    });

    await handleNotificationBatch(
      results.map((result) => ({
        id: result.id,
        transaction: result.transaction,
        changes: result.changes,
      }))
    );

    await logUpdateChanges(changeLogEntries, 'transactions:bulk-update');

    return {
      count: results.length,
    };
  },

  async updateTransaction(payload) {
    let update: TransactionUpdateRecord;
    try {
      update = sanitizeTransactionUpdateRecord(payload);
    } catch (error) {
      throw new TransactionValidationError(
        error instanceof Error ? error.message : 'Invalid transaction payload'
      );
    }

    const validation = transactionUpdateSchema.safeParse({
      ...update.values,
      id: update.id,
    });
    if (!validation.success) {
      throw new TransactionValidationError('Validation failed');
    }

    const existing = await prisma.transaction.findUnique({
      where: { id: update.id },
    });

    if (!existing) {
      throw new TransactionNotFoundError('Transaction not found');
    }

    if (update.values['Order Status'] !== undefined) {
      assertCanSetPaidStatus({
        nextStatus: update.values['Order Status'],
        existing,
        updateValues: update.values,
      });

      await assertOrderStatusNotBackwardToInTransit({
        client: prisma,
        nextStatus: update.values['Order Status'],
        productCode: update.values['Product Code'] ?? existing.productCode,
        shipmentCode: update.values['Shipment Code'] ?? existing.shipmentCode,
      });
    }

    const dbData = buildUpdatePayload(update.values);
    // ========================================================================
    // ⚠️ AUTO LINE TOTAL UPDATE
    // ========================================================================
    // Keep line total consistent with operational inputs when Quantity,
    // Unit Price, or Adjustment changes during single-record updates.
    // ========================================================================
    const recalcLineTotal = shouldRecalculateLineTotal(update.values);
    const computedLineTotal = recalcLineTotal
      ? computeLineTotalForUpdate({
          existing,
          updateValues: update.values,
        })
      : existing.lineTotal;

    if (recalcLineTotal) {
      dbData.lineTotal = computedLineTotal;
    }

    const updatedTransaction = await prisma.transaction.update({
      where: { id: update.id },
      data: dbData,
    });

    await logStatusChange(
      prisma,
      update.id,
      existing.orderStatus,
      updatedTransaction.orderStatus
    );

    await syncInventoryMovementsForTransaction(prisma, updatedTransaction);

    const changes: Array<{
      field: string;
      oldValue: string;
      newValue: string;
    }> = [];

    Object.entries(update.values).forEach(([field, value]) => {
      const oldValue =
        (existing as Record<string, unknown>)[mapFieldName(field)] ?? 'empty';
      const newValue = value ?? 'empty';
      if (String(oldValue) !== String(newValue)) {
        changes.push({
          field,
          oldValue: String(oldValue),
          newValue: String(newValue),
        });
      }
    });

    if (recalcLineTotal && update.values['Line Total'] === undefined) {
      if (String(existing.lineTotal ?? '') !== String(computedLineTotal)) {
        changes.push({
          field: 'Line Total',
          oldValue: String(existing.lineTotal ?? 'empty'),
          newValue: String(computedLineTotal ?? 'empty'),
        });
      }
    }

    let description = `Updated transaction #${updatedTransaction.id}`;
    if (updatedTransaction.customers && updatedTransaction.productCode) {
      description += ` - ${updatedTransaction.customers} (${updatedTransaction.productCode})`;
    }
    if (changes.length > 0) {
      description += ` - Modified: ${changes
        .map((c) => `${c.field}: ${c.oldValue} ---> ${c.newValue}`)
        .join(', ')}`;
    }

    await logOperationNotification('transactions', description, {
      transactionId: updatedTransaction.id,
    });

    await logUpdateChanges(
      [
        {
          entityType: 'transaction',
          entityId: updatedTransaction.id,
          action: 'update',
          oldValue: existing,
          newValue: updatedTransaction,
        },
      ],
      'transactions:update'
    );

    return {
      transaction: mapToDTO(updatedTransaction),
    };
  },

  async softDeleteAll() {
    const alreadyDeleted = await prisma.transaction.count({
      where: { deletedAt: { not: null } },
    });

    const result = await prisma.transaction.updateMany({
      where: { deletedAt: null },
      data: { deletedAt: new Date() },
    });

    await logOperationNotification(
      'transactions',
      `Deleted ${result.count} transaction records`,
      {
        count: result.count,
        alreadyDeleted,
      }
    );

    return {
      deleted: result.count,
      alreadyDeleted,
    };
  },
};
