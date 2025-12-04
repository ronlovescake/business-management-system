import { randomUUID } from 'crypto';
import type { Prisma, Transaction } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getCurrentUser } from '@/lib/auth/session';
import {
  recordChange,
  recordChanges,
  type ChangeLogEntryInput,
} from '@/core/change-log';
import type { TransactionDTO } from './dto';
import { mapToDTO } from './dto';
import {
  EMPTY_SHIPMENT_MARKER,
  isEmptyRow,
  isValidRow,
  sanitizeTransactionRecord,
  sanitizeTransactionUpdateRecord,
} from './sanitizers';
import type { TransactionRecord, TransactionUpdateRecord } from './sanitizers';
import { transactionDataSchema, transactionUpdateSchema } from './schemas';

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

async function logOperationNotification(
  category: string,
  changes: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const id = randomUUID();
    const metadataJson = metadata ? JSON.stringify(metadata) : null;
    const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' });
    const philippineTime = new Date(now);

    await prisma.$executeRaw`
      INSERT INTO "operations_notifications" (id, category, "user", changes, metadata, "createdAt")
      VALUES (${id}, ${category}, ${'Operations'}, ${changes}, ${metadataJson}::jsonb, ${philippineTime})
    `;
  } catch (error) {
    logger.warn('Failed to log operations notification', { error, category });
  }
}

async function resolveChangeLogContext(source: string) {
  try {
    const user = await getCurrentUser();
    return {
      userId: user?.id ?? null,
      userName: user?.name ?? null,
      source,
    } as const;
  } catch (error) {
    logger.warn('Unable to resolve user context for change log', {
      source,
      error,
    });
    return {
      userId: null,
      userName: null,
      source,
    } as const;
  }
}

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

function buildCreateInput(row: TransactionRecord, priceTiers: PriceTier[]) {
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
      logger.debug(
        `Auto-calculated Unit Price for ${productCode} (Qty: ${quantity}): ${tierPriceInPeso} - ${discount} = ${unitPrice}`
      );
    }
  }

  let lineTotal = row['Line Total'];
  if (lineTotal === 0) {
    lineTotal = calculateLineTotal(quantity, unitPrice, adjustment);
    logger.debug(
      `Auto-calculated Line Total: (${quantity} × ${unitPrice}) - ${adjustment} = ${lineTotal}`
    );
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
  const existingProductCodes = new Set(
    existingProducts
      .map((p) => p.productCode)
      .filter((code): code is string => Boolean(code))
  );
  const missingProducts = uniqueProducts.filter(
    (code) => !existingProductCodes.has(code)
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

async function logImportChange(count: number, withData: number, empty: number) {
  try {
    const context = await resolveChangeLogContext('transactions:import');
    await recordChange(
      {
        entityType: 'transaction',
        action: 'import',
        field: 'bulkImport',
        oldValue: null,
        newValue: {
          count,
          withData,
          empty,
        },
        metadata: {
          emptyRows: empty,
        },
      },
      context
    );
  } catch (error) {
    logger.warn('Failed to record change log for transaction import', {
      error,
    });
  }
}

async function logUpdateChanges(
  entries: ChangeLogEntryInput[],
  source: string
) {
  if (entries.length === 0) {
    return;
  }

  try {
    const context = await resolveChangeLogContext(source);
    await recordChanges(entries, context);
  } catch (error) {
    logger.warn('Failed to record change log entries', { error, source });
  }
}

function buildUpdatePayload(values: TransactionUpdateRecord['values']) {
  const data: Prisma.TransactionUpdateInput = {};

  if (values['Order Date'] !== undefined) {
    data.orderDate = values['Order Date'];
  }
  if (values.Customers !== undefined) {
    data.customers = values.Customers;
  }
  if (values['Product Code'] !== undefined) {
    data.productCode = values['Product Code'];
  }
  if (values.Quantity !== undefined) {
    data.quantity = values.Quantity;
  }
  if (values['Unit Price'] !== undefined) {
    data.unitPrice = values['Unit Price'];
  }
  if (values.Discount !== undefined) {
    data.discount = values.Discount;
  }
  if (values.Adjustment !== undefined) {
    data.adjustment = values.Adjustment;
  }
  if (values['Line Total'] !== undefined) {
    data.lineTotal = values['Line Total'];
  }
  if (values['Order Status'] !== undefined) {
    data.orderStatus = values['Order Status'];
  }
  if (values.Notes !== undefined) {
    data.notes = values.Notes;
  }
  if (values['Invoice Date'] !== undefined) {
    data.invoiceDate = values['Invoice Date'];
  }
  if (values['Packed Date'] !== undefined) {
    data.packedDate = values['Packed Date'];
  }
  if (values['Shipment Code'] !== undefined) {
    data.shipmentCode = values['Shipment Code'];
  }

  return data;
}

function describeChange(
  field: string,
  oldValue: unknown,
  newValue: unknown
): string {
  const formattedOld =
    oldValue === null || oldValue === undefined || oldValue === ''
      ? 'empty'
      : String(oldValue);
  const formattedNew =
    newValue === null || newValue === undefined || newValue === ''
      ? 'empty'
      : String(newValue);
  return `${field}: ${formattedOld} → ${formattedNew}`;
}

async function handleNotificationBatch(
  updates: Array<{ id: number; transaction: Transaction; changes: string[] }>
) {
  if (updates.length === 0) {
    return;
  }

  await Promise.all(
    updates.map(async ({ id, transaction, changes }) => {
      let message = `Updated transaction #${id}`;
      if (transaction.customers && transaction.productCode) {
        message += ` - ${transaction.customers} (${transaction.productCode})`;
      } else if (transaction.customers) {
        message += ` - ${transaction.customers}`;
      } else if (transaction.productCode) {
        message += ` - (${transaction.productCode})`;
      }

      if (changes.length > 0) {
        message += ` - Modified: ${changes.join(', ')}`;
      }

      await logOperationNotification('transactions', message, {
        transactionId: id,
      });
    })
  );
}

type TransactionDelegate = typeof prisma.transaction;

async function fetchExistingTransaction(
  delegate: TransactionDelegate,
  id: number
) {
  return delegate.findUnique({
    where: { id },
    select: {
      orderDate: true,
      customers: true,
      productCode: true,
      quantity: true,
      unitPrice: true,
      discount: true,
      adjustment: true,
      lineTotal: true,
      orderStatus: true,
      notes: true,
      invoiceDate: true,
      packedDate: true,
      shipmentCode: true,
    },
  });
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
    const validRows = normalized.filter(
      ({ record }) => isValidRow(record) && !isEmptyRow(record)
    );

    const preparedRows: Prisma.TransactionCreateManyInput[] = [];

    validRows.forEach(({ record, index }) => {
      const validation = transactionDataSchema.safeParse(record);
      if (!validation.success) {
        logger.warn(`Transaction #${index + 1} skipped - validation failed`, {
          row: index + 1,
          issues: validation.error.issues,
        });
        return;
      }

      preparedRows.push(buildCreateInput(validation.data, priceTiers));
    });

    const emptyRowsData = emptyRows.map(({ record }) => ({
      orderDate: record['Order Date'],
      customers: record.Customers,
      productCode: record['Product Code'],
      quantity: 0,
      unitPrice: 0,
      discount: 0,
      adjustment: 0,
      lineTotal: 0,
      orderStatus: record['Order Status'],
      notes: record.Notes,
      invoiceDate: record['Invoice Date'],
      packedDate: record['Packed Date'],
      shipmentCode: EMPTY_SHIPMENT_MARKER,
    }));

    const allRows = [...preparedRows, ...emptyRowsData];

    if (allRows.length === 0) {
      throw new TransactionValidationError(
        'No valid transactions to import. Please review the CSV file.'
      );
    }

    await validateReferences(allRows);

    const result = await prisma.transaction.createMany({ data: allRows });

    await logOperationNotification(
      'transactions',
      `Imported ${result.count} transaction records (${preparedRows.length} with data, ${emptyRowsData.length} empty)`,
      {
        count: result.count,
        withData: preparedRows.length,
        empty: emptyRowsData.length,
      }
    );

    await logImportChange(
      result.count,
      preparedRows.length,
      emptyRowsData.length
    );

    return {
      count: result.count,
      withData: preparedRows.length,
      empty: emptyRowsData.length,
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
      const updateResults = await Promise.all(
        updates.map(async (update) => {
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
          if (update.values['Line Total'] !== undefined) {
            const newValue = update.values['Line Total'];
            if ((existing.lineTotal ?? 0) !== newValue) {
              changes.push(
                describeChange('lineTotal', existing.lineTotal, newValue)
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

          if (changes.length > 0) {
            changeLogEntries.push({
              entityType: 'transaction',
              entityId: id,
              action: 'update',
              oldValue: existing,
              newValue: updated,
            });
          }

          return {
            id,
            transaction: updated,
            changes,
          };
        })
      );

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

    const dbData = buildUpdatePayload(update.values);

    const updatedTransaction = await prisma.transaction.update({
      where: { id: update.id },
      data: dbData,
    });

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

function mapFieldName(field: string): string {
  switch (field) {
    case 'Order Date':
      return 'orderDate';
    case 'Product Code':
      return 'productCode';
    case 'Unit Price':
      return 'unitPrice';
    case 'Line Total':
      return 'lineTotal';
    case 'Order Status':
      return 'orderStatus';
    case 'Invoice Date':
      return 'invoiceDate';
    case 'Packed Date':
      return 'packedDate';
    case 'Shipment Code':
      return 'shipmentCode';
    default:
      return field.charAt(0).toLowerCase() + field.slice(1);
  }
}
