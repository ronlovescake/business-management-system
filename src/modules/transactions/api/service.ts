import type { Prisma, Transaction } from '@prisma/client';
import type { ChangeLogEntryInput } from '@/core/change-log';
import { prisma } from '@/lib/db';
import { isFulfilledStatus, isReservedStatus } from '@/lib/inventory/statuses';
import { logger } from '@/lib/logger';
import type { TransactionDTO } from './dto';
import { mapToDTO } from './dto';
import {
  isEmptyRow,
  isTemplatePreparedRow,
  isValidRow,
  sanitizeTransactionRecord,
  sanitizeTransactionUpdateRecord,
} from './sanitizers';
import type { TransactionUpdateRecord } from './sanitizers';
import {
  TransactionNotFoundError,
  TransactionValidationError,
  validateReferences,
} from './referenceValidation';
export {
  TransactionNotFoundError,
  TransactionReferenceError,
  TransactionValidationError,
} from './referenceValidation';
import { computeLineTotalForUpdate } from './service-calculations';
import { transactionDataSchema, transactionUpdateSchema } from './schemas';
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
import { logStatusChange } from './movementStateHelpers';
import {
  buildTransactionUpdateMessage,
  fetchExistingTransaction,
} from './runtimeHelpers';
import {
  assertCanSetPaidStatus,
  assertOrderStatusNotBackwardToInTransit,
  syncInventoryMovementsForTransaction,
} from './transactionInventorySync';

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
