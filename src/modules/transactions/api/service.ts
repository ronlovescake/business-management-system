import type { Prisma, Transaction } from '@prisma/client';
import type { ChangeLogEntryInput } from '@/core/change-log';
import { prisma } from '@/lib/db';
import { isFulfilledStatus, isReservedStatus } from '@/lib/inventory/statuses';
import { logger } from '@/lib/logger';
import type { TransactionDTO } from './dto';
import { assertTransactionRevision, getCreationKey } from './updateConcurrency';
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
import {
  computeLineTotalForUpdate,
  computeRemainingBalance,
  isPaidStatus,
} from './service-calculations';
import { calculateAccountsReceivableDueDate } from '@/lib/transactions/accounts-receivable';
import {
  isCancelledOrderStatus,
  isClothingAccountsReceivableStatus,
} from '@/lib/transactions/order-status';
import { transactionDataSchema, transactionUpdateSchema } from './schemas';
import {
  buildUpdatePayload,
  assertGenericOrderStatusChange,
  assertClosedOrderFinancialEdit,
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
  deactivateInventoryMovementsForTransaction,
  syncInventoryMovementsForTransaction,
} from './transactionInventorySync';

interface TransactionImportSummary {
  count: number;
  withData: number;
  empty: number;
  transactions?: TransactionDTO[];
}

interface TransactionUpdateSummary {
  count: number;
  transactions?: TransactionDTO[];
}

interface TransactionUpdateResult {
  transaction: TransactionDTO;
}

type AccountsReceivableDateSource = {
  shippedAt?: Date | null;
  accountsReceivableDueAt?: Date | null;
  packedDate?: string | null;
  statusChanges?: Array<{ newStatus: string | null; changedAt: Date }>;
};

function getAccountsReceivableDateData(source: AccountsReceivableDateSource): {
  shippedAt: Date;
  accountsReceivableDueAt: Date;
} {
  const packedDate = source.packedDate ? new Date(source.packedDate) : null;
  const validPackedDate =
    packedDate && Number.isFinite(packedDate.getTime()) ? packedDate : null;
  const statusChangeDate = source.statusChanges?.find((change) =>
    isClothingAccountsReceivableStatus(change.newStatus)
  )?.changedAt;
  const shippedAt =
    source.shippedAt ?? statusChangeDate ?? validPackedDate ?? new Date();

  return {
    shippedAt,
    accountsReceivableDueAt:
      source.accountsReceivableDueAt ??
      calculateAccountsReceivableDueDate(shippedAt),
  };
}

function assertAccountsReceivableHasBalance(params: {
  nextStatus: string | null | undefined;
  existing: Pick<
    Transaction,
    'lineTotal' | 'quantity' | 'unitPrice' | 'discount' | 'adjustment'
  >;
  updateValues: TransactionUpdateRecord['values'];
}) {
  if (!isClothingAccountsReceivableStatus(params.nextStatus)) {
    return;
  }

  const balance = computeRemainingBalance({
    lineTotal: params.updateValues['Line Total'] ?? params.existing.lineTotal,
    quantity: params.updateValues.Quantity ?? params.existing.quantity,
    unitPrice: params.updateValues['Unit Price'] ?? params.existing.unitPrice,
    discount: params.updateValues.Discount ?? params.existing.discount,
    adjustment: params.updateValues.Adjustment ?? params.existing.adjustment,
  });

  if (balance <= 0.01) {
    throw new TransactionValidationError(
      'Accounts Receivable requires a positive outstanding balance.'
    );
  }
}

function resolveOrderStatusForLineTotal(params: {
  requestedStatus: string | null | undefined;
  existingStatus: string | null;
  lineTotal: number | null;
}): string | null | undefined {
  const statusToEvaluate =
    params.requestedStatus === undefined
      ? params.existingStatus
      : params.requestedStatus;
  const lineTotal = Number(params.lineTotal ?? 0);

  if (
    isClothingAccountsReceivableStatus(statusToEvaluate) &&
    Number.isFinite(lineTotal) &&
    Math.round(lineTotal * 100) === 0
  ) {
    return 'Shipped';
  }

  return params.requestedStatus;
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
      include: {
        product: { select: { productCode: true, shipmentCode: true } },
      },
    });
    return transactions.map(mapToDTO);
  },

  async importTransactions(payload) {
    if (!Array.isArray(payload)) {
      throw new TransactionValidationError('Invalid data format');
    }
    const creationKey = getCreationKey(payload);
    if (creationKey) {
      const existing = await prisma.transaction.findUnique({
        where: { creationKey },
      });
      if (existing) {
        if (existing.deletedAt) {
          throw new TransactionValidationError(
            'This created transaction was deleted. Review saved rows before continuing.'
          );
        }
        return {
          count: 1,
          withData: 1,
          empty: 0,
          transactions: [mapToDTO(existing)],
        };
      }
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

      const createInput = buildCreateInput(validation.data, priceTiers);
      if (isClothingAccountsReceivableStatus(createInput.orderStatus)) {
        if (Number(createInput.lineTotal ?? 0) <= 0.01) {
          throw new TransactionValidationError(
            'Accounts Receivable requires a positive outstanding balance.'
          );
        }
        Object.assign(createInput, {
          orderStatus: 'Accounts Receivable',
          ...getAccountsReceivableDateData({
            packedDate: createInput.packedDate,
          }),
        });
      }
      preparedRows.push(createInput);
    }

    const skippedEmptyRows = emptyRows.length;
    const allRows = preparedRows;

    if (allRows.length === 0) {
      throw new TransactionValidationError(
        'No valid transactions to import. Please review the CSV file.'
      );
    }

    await validateReferences(allRows);

    if (creationKey) {
      const created = await prisma.$transaction(
        async (tx) => {
          const row = await tx.transaction.upsert({
            where: { creationKey },
            create: { ...allRows[0], creationKey },
            update: {},
          });
          if (row.deletedAt) {
            throw new TransactionValidationError(
              'This created transaction was deleted. Review saved rows before continuing.'
            );
          }
          await syncInventoryMovementsForTransaction(tx, row);
          return row;
        },
        { isolationLevel: 'Serializable' }
      );
      await logOperationNotification(
        'transactions',
        'Imported 1 transaction record (1 with data, 0 empty rows skipped)',
        { count: 1, withData: 1, empty: 0 }
      );
      await logImportChange(1, 1, 0, 0);
      return {
        count: 1,
        withData: 1,
        empty: 0,
        transactions: [mapToDTO(created)],
      };
    }

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

    const results = await prisma.$transaction(
      async (tx) => {
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
          assertTransactionRevision(
            existing,
            update.revision,
            id,
            Object.keys(update.values)
          );

          const validation = transactionUpdateSchema.safeParse({
            ...update.values,
            id,
          });
          if (!validation.success) {
            throw new TransactionValidationError('Validation failed');
          }

          const dbData = buildUpdatePayload(update.values);
          assertGenericOrderStatusChange(
            update.values['Order Status'],
            existing.orderStatus
          );
          assertClosedOrderFinancialEdit(update.values, existing);
          const preserveClosedHistory = isCancelledOrderStatus(
            existing.orderStatus
          );
          // ==================================================================
          // ⚠️ AUTO LINE TOTAL UPDATE
          // ==================================================================
          // Keep line total consistent with operational inputs when Quantity,
          // Unit Price, or Adjustment changes during bulk updates.
          // ==================================================================
          const recalcLineTotal =
            !preserveClosedHistory && shouldRecalculateLineTotal(update.values);
          const computedLineTotal =
            !preserveClosedHistory &&
            (recalcLineTotal ||
              existing.lineTotal === null ||
              existing.lineTotal === undefined)
              ? computeLineTotalForUpdate({
                  existing,
                  updateValues: update.values,
                })
              : existing.lineTotal;

          if (
            !preserveClosedHistory &&
            (recalcLineTotal ||
              existing.lineTotal === null ||
              existing.lineTotal === undefined)
          ) {
            dbData.lineTotal = computedLineTotal;
          }

          const effectiveUpdateValues = {
            ...update.values,
            'Line Total': computedLineTotal ?? undefined,
          };
          const resolvedOrderStatus = preserveClosedHistory
            ? undefined
            : resolveOrderStatusForLineTotal({
                requestedStatus: update.values['Order Status'],
                existingStatus: existing.orderStatus,
                lineTotal: computedLineTotal,
              });

          if (resolvedOrderStatus !== undefined) {
            assertCanSetPaidStatus({
              nextStatus: resolvedOrderStatus,
              existing,
              updateValues: effectiveUpdateValues,
            });

            assertAccountsReceivableHasBalance({
              nextStatus: resolvedOrderStatus,
              existing,
              updateValues: effectiveUpdateValues,
            });

            if (isClothingAccountsReceivableStatus(resolvedOrderStatus)) {
              dbData.orderStatus = 'Accounts Receivable';
              Object.assign(dbData, getAccountsReceivableDateData(existing));
            } else if (
              update.values['Order Status'] !== undefined ||
              resolvedOrderStatus !== existing.orderStatus
            ) {
              dbData.orderStatus = resolvedOrderStatus;
            }

            if (
              update.values['Order Status'] !== undefined ||
              resolvedOrderStatus !== existing.orderStatus
            ) {
              await assertOrderStatusNotBackwardToInTransit({
                client: tx,
                nextStatus: resolvedOrderStatus,
                productCode:
                  update.values['Product Code'] ?? existing.productCode,
                shipmentCode:
                  update.values['Shipment Code'] ?? existing.shipmentCode,
              });
            }
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
          if (
            recalcLineTotal ||
            existing.lineTotal === null ||
            existing.lineTotal === undefined
          ) {
            if ((existing.lineTotal ?? 0) !== computedLineTotal) {
              changes.push(
                describeChange(
                  'lineTotal',
                  existing.lineTotal,
                  computedLineTotal
                )
              );
            }
          }
          if (
            resolvedOrderStatus !== undefined &&
            (update.values['Order Status'] !== undefined ||
              resolvedOrderStatus !== existing.orderStatus)
          ) {
            const newValue = resolvedOrderStatus ?? '';
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
            where: {
              id,
              ...(update.revision ? { updatedAt: existing.updatedAt } : {}),
            },
            data: dbData,
          });

          await logStatusChange(
            tx,
            id,
            existing.orderStatus,
            updated.orderStatus
          );
          if (!preserveClosedHistory) {
            await syncInventoryMovementsForTransaction(tx, updated);
          }

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
      },
      { isolationLevel: 'Serializable' }
    );

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
      transactions: results.map((result) => mapToDTO(result.transaction)),
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

    const {
      existing,
      updatedTransaction,
      recalcLineTotal,
      computedLineTotal,
      resolvedOrderStatus,
    } = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.transaction.findUnique({
          where: { id: update.id },
          include: {
            statusChanges: {
              where: {
                newStatus: { in: ['Accounts Receivable', 'Pending Payment'] },
              },
              orderBy: { changedAt: 'asc' },
              take: 1,
              select: { newStatus: true, changedAt: true },
            },
          },
        });

        if (!existing) {
          throw new TransactionNotFoundError('Transaction not found');
        }
        assertTransactionRevision(
          existing,
          update.revision,
          update.id,
          Object.keys(update.values)
        );

        const dbData = buildUpdatePayload(update.values);
        assertGenericOrderStatusChange(
          update.values['Order Status'],
          existing.orderStatus
        );
        assertClosedOrderFinancialEdit(update.values, existing);
        const preserveClosedHistory = isCancelledOrderStatus(
          existing.orderStatus
        );
        // ========================================================================
        // ⚠️ AUTO LINE TOTAL UPDATE
        // ========================================================================
        // Keep line total consistent with operational inputs when Quantity,
        // Unit Price, or Adjustment changes during single-record updates.
        // ========================================================================
        const recalcLineTotal =
          !preserveClosedHistory && shouldRecalculateLineTotal(update.values);
        const computedLineTotal =
          !preserveClosedHistory &&
          (recalcLineTotal ||
            existing.lineTotal === null ||
            existing.lineTotal === undefined)
            ? computeLineTotalForUpdate({
                existing,
                updateValues: update.values,
              })
            : existing.lineTotal;

        if (
          !preserveClosedHistory &&
          (recalcLineTotal ||
            existing.lineTotal === null ||
            existing.lineTotal === undefined)
        ) {
          dbData.lineTotal = computedLineTotal;
        }

        const effectiveUpdateValues = {
          ...update.values,
          'Line Total': computedLineTotal ?? undefined,
        };
        const resolvedOrderStatus = preserveClosedHistory
          ? undefined
          : resolveOrderStatusForLineTotal({
              requestedStatus: update.values['Order Status'],
              existingStatus: existing.orderStatus,
              lineTotal: computedLineTotal,
            });

        if (resolvedOrderStatus !== undefined) {
          assertCanSetPaidStatus({
            nextStatus: resolvedOrderStatus,
            existing,
            updateValues: effectiveUpdateValues,
          });

          assertAccountsReceivableHasBalance({
            nextStatus: resolvedOrderStatus,
            existing,
            updateValues: effectiveUpdateValues,
          });

          if (isClothingAccountsReceivableStatus(resolvedOrderStatus)) {
            dbData.orderStatus = 'Accounts Receivable';
            Object.assign(dbData, getAccountsReceivableDateData(existing));
          } else if (
            update.values['Order Status'] !== undefined ||
            resolvedOrderStatus !== existing.orderStatus
          ) {
            dbData.orderStatus = resolvedOrderStatus;
          }

          if (
            update.values['Order Status'] !== undefined ||
            resolvedOrderStatus !== existing.orderStatus
          ) {
            await assertOrderStatusNotBackwardToInTransit({
              client: tx,
              nextStatus: resolvedOrderStatus,
              productCode:
                update.values['Product Code'] ?? existing.productCode,
              shipmentCode:
                update.values['Shipment Code'] ?? existing.shipmentCode,
            });
          }
        }

        const updatedTransaction = await tx.transaction.update({
          where: {
            id: update.id,
            ...(update.revision ? { updatedAt: existing.updatedAt } : {}),
          },
          data: dbData,
        });

        await logStatusChange(
          tx,
          update.id,
          existing.orderStatus,
          updatedTransaction.orderStatus
        );

        if (!preserveClosedHistory) {
          await syncInventoryMovementsForTransaction(tx, updatedTransaction);
        }
        return {
          existing,
          updatedTransaction,
          recalcLineTotal,
          computedLineTotal,
          resolvedOrderStatus,
        };
      },
      { isolationLevel: 'Serializable' }
    );

    const changes: Array<{
      field: string;
      oldValue: string;
      newValue: string;
    }> = [];

    Object.entries(update.values).forEach(([field, value]) => {
      const effectiveValue =
        field === 'Order Status' && resolvedOrderStatus !== undefined
          ? resolvedOrderStatus
          : value;
      const oldValue =
        (existing as Record<string, unknown>)[mapFieldName(field)] ?? 'empty';
      const newValue = effectiveValue ?? 'empty';
      if (String(oldValue) !== String(newValue)) {
        changes.push({
          field,
          oldValue: String(oldValue),
          newValue: String(newValue),
        });
      }
    });

    if (
      update.values['Order Status'] === undefined &&
      resolvedOrderStatus !== undefined &&
      resolvedOrderStatus !== existing.orderStatus
    ) {
      changes.push({
        field: 'Order Status',
        oldValue: String(existing.orderStatus ?? 'empty'),
        newValue: resolvedOrderStatus ?? '',
      });
    }

    if (
      (recalcLineTotal ||
        existing.lineTotal === null ||
        existing.lineTotal === undefined) &&
      update.values['Line Total'] === undefined
    ) {
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

    const result = await prisma.$transaction(
      async (tx) => {
        const transactions = await tx.transaction.findMany({
          where: { deletedAt: null },
          include: {
            payments: { where: { deletedAt: null }, take: 1 },
            refunds: { where: { deletedAt: null }, take: 1 },
            statusChanges: { select: { newStatus: true } },
          },
        });
        for (const transaction of transactions) {
          if (
            isFulfilledStatus(transaction.orderStatus) ||
            isPaidStatus(transaction.orderStatus) ||
            transaction.statusChanges?.some(
              (change) =>
                isFulfilledStatus(change.newStatus) ||
                isPaidStatus(change.newStatus)
            ) ||
            (transaction.adjustment ?? 0) > 0 ||
            (transaction.refundAmount ?? 0) > 0 ||
            (transaction.refundQty ?? 0) > 0 ||
            transaction.shippedAt ||
            transaction.packedDate ||
            transaction.invoiceDate ||
            transaction.payments.length > 0 ||
            transaction.refunds.length > 0
          ) {
            throw new TransactionValidationError(
              'Cannot mass-delete transactions with payment, refund, invoice or shipment history. Use the supported reversal workflow.'
            );
          }
        }

        const ids = transactions.map((transaction) => transaction.id);
        if (ids.length === 0) {
          return { count: 0 };
        }
        const postedMovement = await tx.inventoryMovement.findFirst({
          where: {
            deletedAt: null,
            AND: [
              { OR: [{ fromBucket: 'sold' }, { toBucket: 'sold' }] },
              {
                OR: [
                  { sourceTransactionId: { in: ids } },
                  ...ids.flatMap((id) => [
                    { notes: `auto-sale txn ${id}` },
                    { notes: { startsWith: `auto-sale txn ${id} mix ` } },
                  ]),
                ],
              },
            ],
          },
          select: { id: true },
        });
        if (postedMovement) {
          throw new TransactionValidationError(
            'Cannot mass-delete transactions with posted inventory movements. Reverse them first.'
          );
        }

        for (const transaction of transactions) {
          await deactivateInventoryMovementsForTransaction(tx, transaction.id);
        }
        return tx.transaction.updateMany({
          where: { id: { in: ids }, deletedAt: null },
          data: { deletedAt: new Date() },
        });
      },
      { isolationLevel: 'Serializable' }
    );

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
