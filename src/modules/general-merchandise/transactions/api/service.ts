import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { TransactionDTO } from '@/modules/transactions/api/dto';
import { mapToDTO } from '@/modules/transactions/api/dto';
import { isFulfilledStatus, isReservedStatus } from '@/lib/inventory/statuses';
import {
  EMPTY_SHIPMENT_MARKER,
  isEmptyRow,
  isTemplatePreparedRow,
  isValidRow,
  sanitizeTransactionRecord,
  sanitizeTransactionUpdateRecord,
} from '@/modules/transactions/api/sanitizers';
import {
  transactionDataSchema,
  transactionUpdateSchema,
} from '@/modules/transactions/api/schemas';
import {
  TransactionReferenceError,
  TransactionValidationError,
} from '@/modules/transactions/api/service';

interface PriceTier {
  productCode: string | null;
  lowerLimit: number;
  upperLimit: number;
  currentPrice: number;
}

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

const gmPrisma = prisma as {
  generalMerchandiseTransaction: typeof prisma.generalMerchandiseTransaction;
  generalMerchandiseInventoryMovement: typeof prisma.generalMerchandiseInventoryMovement;
  generalMerchandiseCustomer: typeof prisma.generalMerchandiseCustomer;
  generalMerchandiseProduct: typeof prisma.generalMerchandiseProduct;
  generalMerchandiseShipment: typeof prisma.generalMerchandiseShipment;
  generalMerchandisePrice: typeof prisma.generalMerchandisePrice;
};

function getUnitPriceForQuantity(
  productCode: string,
  quantity: number,
  priceTiers: PriceTier[]
): number {
  if (!productCode || !quantity || quantity <= 0) {
    return 0;
  }

  const matchingTier = priceTiers.find((tier) => {
    if (!tier.productCode) {
      return false;
    }
    if (tier.productCode !== productCode) {
      return false;
    }
    const lowerLimit = tier.lowerLimit / 100;
    const upperLimit = tier.upperLimit / 100;
    return quantity >= lowerLimit && quantity <= upperLimit;
  });

  return matchingTier ? matchingTier.currentPrice : 0;
}

function calculateLineTotal(
  quantity: number,
  unitPrice: number,
  adjustment: number
): number {
  return quantity * unitPrice - adjustment;
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function computeRemainingBalance(params: {
  lineTotal: unknown;
  quantity: unknown;
  unitPrice: unknown;
  discount: unknown;
  adjustment: unknown;
}): number {
  const lineTotal = toFiniteNumber(params.lineTotal, Number.NaN);
  if (Number.isFinite(lineTotal)) {
    return lineTotal;
  }

  const quantity = toFiniteNumber(params.quantity, 0);
  const unitPrice = toFiniteNumber(params.unitPrice, 0);
  const discount = toFiniteNumber(params.discount, 0);
  const adjustment = toFiniteNumber(params.adjustment, 0);

  return quantity * unitPrice - discount - adjustment;
}

function normalizeProductCode(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function buildAutoSaleMovementNote(transactionId: number) {
  return `auto-sale txn ${transactionId}`;
}

function buildAutoReserveMovementNote(transactionId: number) {
  return `auto-reserve txn ${transactionId}`;
}

type TransactionForInventorySync = {
  id: number;
  productCode: string | null;
  quantity: number | null;
  unitPrice: number | null;
  discount: number | null;
  lineTotal: number | null;
  orderDate: string | null;
  packedDate: string | null;
  orderStatus: string | null;
  adjustment: number | null;
};

type AutoMovementRecord = {
  id: number;
  deletedAt: Date | null;
};

type AutoMovementMetadata = {
  sourceTransactionId: number;
  movementSource: 'transaction';
  movementType: 'reserve' | 'sale';
};

async function findLatestAutoMovement(
  client: typeof gmPrisma,
  note: string
): Promise<AutoMovementRecord | null> {
  return client.generalMerchandiseInventoryMovement.findFirst({
    where: { notes: note },
    orderBy: { createdAt: 'desc' },
    select: { id: true, deletedAt: true },
  }) as Promise<AutoMovementRecord | null>;
}

async function setAutoMovementActive(params: {
  client: typeof gmPrisma;
  existing: AutoMovementRecord | null;
  productCode: string;
  quantity: number;
  fromBucket: Prisma.InventoryMovementCreateInput['fromBucket'];
  toBucket: Prisma.InventoryMovementCreateInput['toBucket'];
  postingDate: string | null;
  note: string;
  metadata: AutoMovementMetadata;
}) {
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
    await client.generalMerchandiseInventoryMovement.update({
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
    const created = (await client.generalMerchandiseInventoryMovement.create({
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
    })) as { id: number };

    activeId = created.id;
  }

  if (activeId) {
    await client.generalMerchandiseInventoryMovement.updateMany({
      where: {
        notes: note,
        deletedAt: null,
        NOT: { id: activeId },
      },
      data: { deletedAt: now },
    });
  }
}

async function setAutoMovementInactive(params: {
  client: typeof gmPrisma;
  note: string;
}) {
  const { client, note } = params;
  await client.generalMerchandiseInventoryMovement.updateMany({
    where: { notes: note, deletedAt: null },
    data: { deletedAt: new Date() },
  });
}

async function syncInventoryMovementsForTransaction(
  client: typeof gmPrisma,
  transaction: TransactionForInventorySync
) {
  const productCode = normalizeProductCode(transaction.productCode);
  const quantity = transaction.quantity ?? 0;

  const reserveNote = buildAutoReserveMovementNote(transaction.id);
  const saleNote = buildAutoSaleMovementNote(transaction.id);

  const [existingReserve, existingSale] = await Promise.all([
    findLatestAutoMovement(client, reserveNote),
    findLatestAutoMovement(client, saleNote),
  ]);

  if (!productCode || quantity <= 0) {
    await Promise.all([
      setAutoMovementInactive({ client, note: reserveNote }),
      setAutoMovementInactive({ client, note: saleNote }),
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

  const fulfilled =
    isFulfilledStatus(transaction.orderStatus) ||
    treatedAsFulfilledBecausePaidAndPrepared;

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
        sourceTransactionId: transaction.id,
        movementSource: 'transaction',
        movementType: 'reserve',
      },
    });
  } else {
    await setAutoMovementInactive({ client, note: reserveNote });
  }

  const reserveIsActive = shouldKeepReserveActive;

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
      metadata: {
        sourceTransactionId: transaction.id,
        movementSource: 'transaction',
        movementType: 'sale',
      },
    });
  } else {
    await setAutoMovementInactive({ client, note: saleNote });
  }
}

function buildCreateInput(
  row: {
    'Order Date': string;
    Customers: string;
    'Product Code': string;
    Quantity: number;
    'Unit Price': number;
    Discount: number;
    Adjustment: number;
    'Line Total': number;
    'Order Status': string | null;
    Notes: string | null;
    'Invoice Date': string | null;
    'Packed Date': string | null;
    'Shipment Code': string | null;
  },
  priceTiers: PriceTier[]
): Prisma.TransactionCreateManyInput {
  const quantity = row.Quantity;
  const discount = row.Discount;
  const adjustment = row.Adjustment;
  const productCode = row['Product Code'];

  let unitPrice = row['Unit Price'];
  if (unitPrice === 0 && quantity > 0 && productCode) {
    const tierPrice = getUnitPriceForQuantity(
      productCode,
      quantity,
      priceTiers
    );
    if (tierPrice > 0) {
      const tierPriceInPeso = tierPrice / 100;
      unitPrice = tierPriceInPeso - discount;
    }
  }

  let lineTotal = row['Line Total'];
  if (lineTotal === 0) {
    lineTotal = calculateLineTotal(quantity, unitPrice, adjustment);
  }

  return {
    orderDate: row['Order Date'],
    customers: row.Customers,
    productCode,
    quantity,
    unitPrice,
    discount,
    adjustment,
    lineTotal,
    orderStatus: row['Order Status'] || null,
    notes: row.Notes,
    invoiceDate: row['Invoice Date'],
    packedDate: row['Packed Date'],
    shipmentCode: row['Shipment Code'],
  } satisfies Prisma.TransactionCreateManyInput;
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
        .filter((s): s is string => {
          if (!s) {
            return false;
          }
          if (s === EMPTY_SHIPMENT_MARKER) {
            return false;
          }
          return s.trim().toLowerCase() !== 'domestic';
        })
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

  const existingProducts = await gmPrisma.generalMerchandiseProduct.findMany({
    where: { productCode: { in: uniqueProducts } },
    select: { productCode: true },
  });

  const existingProductCodeSet = new Set<string>();
  existingProducts
    .map((p) => p.productCode)
    .filter((code): code is string => Boolean(code))
    .forEach((code) => existingProductCodeSet.add(code.toLowerCase()));

  const missingProducts = uniqueProducts.filter(
    (code) => !existingProductCodeSet.has(code.toLowerCase())
  );

  const existingShipments = await gmPrisma.generalMerchandiseShipment.findMany({
    where: { shipmentCode: { in: uniqueShipments } },
    select: { shipmentCode: true },
  });

  const existingShipmentSet = new Set(
    existingShipments.map((s) => s.shipmentCode)
  );
  const missingShipments = uniqueShipments.filter(
    (code) => !existingShipmentSet.has(code)
  );

  if (
    missingCustomers.length > 0 ||
    missingProducts.length > 0 ||
    missingShipments.length > 0
  ) {
    throw new TransactionReferenceError('Reference validation failed', {
      missing: {
        customers: missingCustomers,
        products: missingProducts,
        shipments: missingShipments,
      },
      counts: {
        customers: missingCustomers.length,
        products: missingProducts.length,
        shipments: missingShipments.length,
      },
      suggestion:
        'Create the missing customers/products/shipments before importing transactions.',
    });
  }
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

export const generalMerchandiseTransactionService: TransactionService = {
  async findActive() {
    const transactions = (await gmPrisma.generalMerchandiseTransaction.findMany(
      {
        where: { deletedAt: null },
        orderBy: { id: 'asc' },
      }
    )) as Array<Parameters<typeof mapToDTO>[0]>;

    return transactions.map((transaction) => mapToDTO(transaction));
  },

  async importTransactions(payload) {
    if (!Array.isArray(payload)) {
      throw new TransactionValidationError('Invalid data format');
    }

    const normalized = payload.map((entry, index) => ({
      index,
      record: sanitizeTransactionRecord(entry),
    }));

    const priceTiers = await gmPrisma.generalMerchandisePrice.findMany({
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

    validRows.forEach(({ record, index }) => {
      const validation = transactionDataSchema.safeParse(record);
      if (!validation.success) {
        logger.warn(
          `GM Transaction #${index + 1} skipped - validation failed`,
          {
            row: index + 1,
            issues: validation.error.issues,
          }
        );
        return;
      }

      if (isTemplatePreparedRow(validation.data)) {
        return;
      }

      preparedRows.push(buildCreateInput(validation.data, priceTiers));
    });

    const skippedEmptyRows = emptyRows.length;
    if (preparedRows.length === 0) {
      throw new TransactionValidationError(
        'No valid transactions to import. Please review the CSV file.'
      );
    }

    await validateReferences(preparedRows);

    const importStartedAt = new Date();
    const result = await gmPrisma.generalMerchandiseTransaction.createMany({
      data: preparedRows,
    });

    const createdTransactions =
      (await gmPrisma.generalMerchandiseTransaction.findMany({
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
      })) as TransactionForInventorySync[];

    const needsMovementSync = createdTransactions.filter(
      (tx) =>
        isReservedStatus(tx.orderStatus) || isFulfilledStatus(tx.orderStatus)
    );

    for (const created of needsMovementSync) {
      await syncInventoryMovementsForTransaction(gmPrisma, created);
    }

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

    let updatedCount = 0;

    for (const entry of payload) {
      const updateRecord = sanitizeTransactionUpdateRecord(entry);
      const validation = transactionUpdateSchema.safeParse(updateRecord);
      if (!validation.success) {
        continue;
      }

      const updated = (await gmPrisma.generalMerchandiseTransaction.update({
        where: { id: updateRecord.id },
        data: {
          orderDate: updateRecord.values['Order Date'],
          customers: updateRecord.values.Customers,
          productCode: updateRecord.values['Product Code'],
          quantity: updateRecord.values.Quantity,
          unitPrice: updateRecord.values['Unit Price'],
          discount: updateRecord.values.Discount,
          lineTotal: updateRecord.values['Line Total'],
          orderStatus: updateRecord.values['Order Status'],
          notes: updateRecord.values.Notes,
          invoiceDate: updateRecord.values['Invoice Date'],
          packedDate: updateRecord.values['Packed Date'],
          shipmentCode: updateRecord.values['Shipment Code'],
        },
      })) as TransactionForInventorySync;

      await syncInventoryMovementsForTransaction(gmPrisma, updated);
      updatedCount += 1;
    }

    return { count: updatedCount };
  },

  async updateTransaction(payload) {
    const updateRecord = sanitizeTransactionUpdateRecord(payload);
    const validation = transactionUpdateSchema.safeParse(updateRecord);
    if (!validation.success) {
      throw new TransactionValidationError('Invalid transaction payload');
    }

    const updated = (await gmPrisma.generalMerchandiseTransaction.update({
      where: { id: updateRecord.id },
      data: {
        orderDate: updateRecord.values['Order Date'],
        customers: updateRecord.values.Customers,
        productCode: updateRecord.values['Product Code'],
        quantity: updateRecord.values.Quantity,
        unitPrice: updateRecord.values['Unit Price'],
        discount: updateRecord.values.Discount,
        lineTotal: updateRecord.values['Line Total'],
        orderStatus: updateRecord.values['Order Status'],
        notes: updateRecord.values.Notes,
        invoiceDate: updateRecord.values['Invoice Date'],
        packedDate: updateRecord.values['Packed Date'],
        shipmentCode: updateRecord.values['Shipment Code'],
      },
    })) as Parameters<typeof mapToDTO>[0];

    const updatedForSync: TransactionForInventorySync = {
      id: updated.id,
      productCode: updated.productCode,
      quantity: updated.quantity,
      unitPrice: updated.unitPrice,
      discount: updated.discount,
      lineTotal: updated.lineTotal,
      orderDate: updated.orderDate,
      packedDate: updated.packedDate,
      orderStatus: updated.orderStatus,
      adjustment: updated.adjustment,
    };

    await syncInventoryMovementsForTransaction(gmPrisma, updatedForSync);

    return { transaction: mapToDTO(updated) };
  },

  async softDeleteAll() {
    const alreadyDeleted =
      await gmPrisma.generalMerchandiseTransaction.updateMany({
        where: { deletedAt: { not: null } },
        data: { deletedAt: new Date() },
      });

    const result = await gmPrisma.generalMerchandiseTransaction.updateMany({
      where: { deletedAt: null },
      data: { deletedAt: new Date() },
    });

    return {
      deleted: result.count,
      alreadyDeleted: alreadyDeleted.count,
    };
  },
};
