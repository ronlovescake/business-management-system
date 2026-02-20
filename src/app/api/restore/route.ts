/**
 * Restore API Route
 *
 * Handles database restore operations from backups
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import fs from 'fs';
import path from 'path';
import { logger } from '@/lib/logger';
import { sortTablesForRestore } from './restore-order';
import {
  chunkArray,
  getChangedFields,
  normalizeRecord,
  recordsMatch,
  type RowRecord,
} from './restorePreviewUtils';
import {
  computeFileSha256,
  isSafeBackupFilename,
  isValidTimestampFolderName,
  requireBackupRestoreAdmin,
} from '../backup-restore/sharedRouteUtils';
const BACKUP_DIR = path.resolve(process.cwd(), 'backups');
const RESTORE_MUTEX_KEY = '__restore_global__';
const activeRestoreMutexes = new Set<string>();

type RestoreCountResult = { count: number };

type RestoreModelDelegate = {
  findFirst: (args?: unknown) => Promise<unknown>;
  findMany: (args?: unknown) => Promise<unknown[]>;
  count: (args?: unknown) => Promise<number>;
  createMany: (args: {
    data: RowRecord[];
    skipDuplicates: boolean;
  }) => Promise<RestoreCountResult>;
  update: (args: {
    where: { id: number | string };
    data: RowRecord;
  }) => Promise<unknown>;
  deleteMany: (args?: unknown) => Promise<unknown>;
  updateMany: (args: {
    where: { id: { in: Array<number | string> } };
    data: { deletedAt: null };
  }) => Promise<RestoreCountResult>;
};

const getModelDelegate = (
  source: unknown,
  modelName: string
): RestoreModelDelegate => {
  const sourceRecord = source as Record<string, unknown>;
  const delegate = sourceRecord[modelName] as Partial<RestoreModelDelegate>;

  if (!delegate || typeof delegate !== 'object') {
    throw new Error(`Invalid model delegate for: ${modelName}`);
  }

  return delegate as RestoreModelDelegate;
};

const PREVIEW_SAMPLE_LIMIT = 200;
const FIND_MANY_CHUNK_SIZE = 2000;
const CREATE_MANY_CHUNK_SIZE = 1000;

const ensureModelSupportsDeletedAt = async (
  modelDelegate: RestoreModelDelegate,
  tableName: string
) => {
  try {
    // This validates the field exists even when the table is empty.
    await modelDelegate.findFirst({ select: { deletedAt: true } });
    return { ok: true } as const;
  } catch (error) {
    logger.warn('Soft-delete restore requested for unsupported table', {
      tableName,
      error,
    });
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Table does not support deletedAt',
    } as const;
  }
};

type PreviewChange = {
  id: number | string | null;
  changes: Record<string, { before: unknown; after: unknown }>;
  incoming: RowRecord;
  existing?: RowRecord;
};

type PreviewTableResult = {
  attempted: number;
  insertCount?: number;
  inserts: RowRecord[];
  truncatedInserts?: boolean;
  updateCount?: number;
  updates: PreviewChange[];
  truncatedUpdates?: boolean;
  skipped: number;
  notice?: string;
  deletedCount?: number;
};

const fetchExistingByIds = async (
  modelDelegate: RestoreModelDelegate,
  ids: Array<number | string>
): Promise<Map<number | string, RowRecord>> => {
  const map = new Map<number | string, RowRecord>();
  const uniqueIds = Array.from(new Set(ids));

  for (const chunk of chunkArray(uniqueIds, FIND_MANY_CHUNK_SIZE)) {
    if (!chunk.length) {
      continue;
    }

    const rows = await modelDelegate.findMany({
      where: { id: { in: chunk } },
    });

    for (const row of rows) {
      if (!row || typeof row !== 'object') {
        continue;
      }
      const typedRow = row as RowRecord;
      const id = typedRow.id as number | string | undefined;
      if (id !== undefined && id !== null) {
        map.set(id, typedRow);
      }
    }
  }

  return map;
};

const processTablePreview = async (
  modelDelegate: RestoreModelDelegate,
  tableData: { data: RowRecord[] },
  forceOverwrite: boolean
): Promise<PreviewTableResult> => {
  if (forceOverwrite) {
    const beforeCount = await modelDelegate.count();
    const sample = tableData.data
      .slice(0, PREVIEW_SAMPLE_LIMIT)
      .map((row) => normalizeRecord(row));
    const insertCount = tableData.data.length;
    return {
      attempted: insertCount,
      insertCount,
      inserts: sample,
      truncatedInserts: insertCount > PREVIEW_SAMPLE_LIMIT,
      updateCount: 0,
      updates: [],
      truncatedUpdates: false,
      skipped: 0,
      notice:
        'Force overwrite is enabled. Existing records will be deleted before applying this backup.',
      deletedCount: beforeCount,
    };
  }

  const preview: PreviewTableResult = {
    attempted: tableData.data.length,
    insertCount: 0,
    inserts: [],
    truncatedInserts: false,
    updateCount: 0,
    updates: [],
    truncatedUpdates: false,
    skipped: 0,
  };

  const ids: Array<number | string> = [];
  const normalizedIncoming: RowRecord[] = [];
  for (const rawRecord of tableData.data as RowRecord[]) {
    const record = normalizeRecord(rawRecord);
    normalizedIncoming.push(record);
    const recordId = record.id as number | string | null | undefined;
    if (recordId !== null && recordId !== undefined) {
      ids.push(recordId);
    }
  }

  const existingById = ids.length
    ? await fetchExistingByIds(modelDelegate, ids)
    : new Map<number | string, RowRecord>();

  for (const record of normalizedIncoming) {
    const recordId = record.id as number | string | null | undefined;

    if (recordId === null || recordId === undefined) {
      preview.insertCount = (preview.insertCount ?? 0) + 1;
      if (preview.inserts.length < PREVIEW_SAMPLE_LIMIT) {
        preview.inserts.push(record);
      } else {
        preview.truncatedInserts = true;
      }
      continue;
    }

    const existing = existingById.get(recordId);

    if (!existing) {
      preview.insertCount = (preview.insertCount ?? 0) + 1;
      if (preview.inserts.length < PREVIEW_SAMPLE_LIMIT) {
        preview.inserts.push(record);
      } else {
        preview.truncatedInserts = true;
      }
      continue;
    }

    const normalizedExisting = normalizeRecord(existing as RowRecord);

    if (recordsMatch(normalizedExisting, record)) {
      preview.skipped++;
      continue;
    }

    preview.updateCount = (preview.updateCount ?? 0) + 1;
    if (preview.updates.length < PREVIEW_SAMPLE_LIMIT) {
      preview.updates.push({
        id: recordId,
        changes: getChangedFields(normalizedExisting, record),
        incoming: record,
        existing: normalizedExisting,
      });
    } else {
      preview.truncatedUpdates = true;
    }
  }

  return preview;
};

const processTableRestore = async (
  modelDelegate: RestoreModelDelegate,
  _modelName: string,
  tableData: { data: RowRecord[] },
  forceOverwrite: boolean
) => {
  const beforeCount = await modelDelegate.count();

  if (forceOverwrite) {
    await modelDelegate.deleteMany({});
    let createdTotal = 0;
    for (const chunk of chunkArray(tableData.data, CREATE_MANY_CHUNK_SIZE)) {
      if (!chunk.length) {
        continue;
      }
      const createdResult = await modelDelegate.createMany({
        data: chunk,
        skipDuplicates: false,
      });
      createdTotal += createdResult.count;
    }
    const afterCount = await modelDelegate.count();

    return {
      count: createdTotal,
      updated: 0,
      beforeCount,
      afterCount,
      attempted: tableData.data.length,
      skipped: 0,
    };
  }

  // Bulk insert new rows efficiently, then update only those that differ.
  let created = 0;
  for (const chunk of chunkArray(tableData.data, CREATE_MANY_CHUNK_SIZE)) {
    if (!chunk.length) {
      continue;
    }
    const createdResult = await modelDelegate.createMany({
      data: chunk,
      skipDuplicates: true,
    });
    created += createdResult.count;
  }

  const rowsWithId: Array<{ id: number | string; incoming: RowRecord }> = [];
  const ids: Array<number | string> = [];
  for (const rawRecord of tableData.data as RowRecord[]) {
    const record = rawRecord as RowRecord;
    const recordId = record.id as number | string | null | undefined;
    if (recordId === null || recordId === undefined) {
      continue;
    }
    ids.push(recordId);
    rowsWithId.push({ id: recordId, incoming: record });
  }

  const existingById = ids.length
    ? await fetchExistingByIds(modelDelegate, ids)
    : new Map<number | string, RowRecord>();

  let updated = 0;

  for (const row of rowsWithId) {
    const existing = existingById.get(row.id);
    if (!existing) {
      continue;
    }

    const incomingNormalized = normalizeRecord(row.incoming);
    const existingNormalized = normalizeRecord(existing);

    if (recordsMatch(existingNormalized, incomingNormalized)) {
      continue;
    }

    const dataToUpdate = { ...(row.incoming as RowRecord) };
    delete dataToUpdate.id;
    delete dataToUpdate.updatedAt;

    await modelDelegate.update({
      where: { id: row.id },
      data: dataToUpdate,
    });
    updated++;
  }

  const afterCount = await modelDelegate.count();

  return {
    count: created,
    updated,
    beforeCount,
    afterCount,
    attempted: tableData.data.length,
    skipped: Math.max(0, tableData.data.length - created - updated),
  };
};

// POST - Restore from backup
export async function POST(request: NextRequest) {
  const authError = await requireBackupRestoreAdmin();
  if (authError) {
    return authError;
  }

  let lockAcquired = false;

  try {
    const body = (await request.json()) as {
      timestamp?: string;
      file?: string;
      tables?: string[];
      forceOverwrite?: boolean;
      previewOnly?: boolean;
      stopOnError?: boolean;
    };
    const {
      timestamp,
      file,
      tables,
      forceOverwrite = false,
      previewOnly = false,
      stopOnError = true,
    } = body;

    if (
      typeof forceOverwrite !== 'boolean' ||
      typeof previewOnly !== 'boolean' ||
      typeof stopOnError !== 'boolean'
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid restore options payload' },
        { status: 400 }
      );
    }

    const shouldAbortOnError = stopOnError && !previewOnly;

    if (!previewOnly) {
      if (activeRestoreMutexes.has(RESTORE_MUTEX_KEY)) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Another restore operation is already in progress. Please retry after it completes.',
          },
          { status: 409 }
        );
      }

      activeRestoreMutexes.add(RESTORE_MUTEX_KEY);
      lockAcquired = true;
    }

    if (!timestamp || !file) {
      return NextResponse.json(
        { success: false, error: 'Missing timestamp or file parameter' },
        { status: 400 }
      );
    }

    if (!isValidTimestampFolderName(timestamp)) {
      return NextResponse.json(
        { success: false, error: 'Invalid timestamp format' },
        { status: 400 }
      );
    }

    if (!isSafeBackupFilename(file)) {
      return NextResponse.json(
        { success: false, error: 'Invalid backup filename' },
        { status: 400 }
      );
    }

    const backupPath = path.join(BACKUP_DIR, timestamp, file);
    const resolvedPath = path.resolve(backupPath);
    const resolvedBackupDir = path.resolve(BACKUP_DIR);
    if (!resolvedPath.startsWith(resolvedBackupDir)) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    if (!fs.existsSync(backupPath)) {
      return NextResponse.json(
        { success: false, error: 'Backup file not found' },
        { status: 404 }
      );
    }

    // Only JSON restore is supported via API (SQL requires psql command)
    if (!file.endsWith('.json')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Only JSON backups can be restored via API',
        },
        { status: 400 }
      );
    }

    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8')) as {
      tables?: Record<string, { data?: RowRecord[] }>;
    };

    if (!backupData.tables || typeof backupData.tables !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid backup file format' },
        { status: 400 }
      );
    }

    // If manifest includes checksums, verify selected backup file integrity before restore.
    const manifestPath = path.join(BACKUP_DIR, timestamp, 'MANIFEST.json');
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
        files?: Array<{ name: string; checksum?: string }>;
        integrity?: { fileChecksums?: Record<string, string> };
      };
      const manifestEntry = manifest.files?.find(
        (entry) => entry.name === file
      );
      const expectedChecksum =
        manifestEntry?.checksum ?? manifest.integrity?.fileChecksums?.[file];

      if (expectedChecksum) {
        const actualChecksum = await computeFileSha256(backupPath);
        if (actualChecksum !== expectedChecksum) {
          return NextResponse.json(
            {
              success: false,
              error: 'Backup integrity verification failed',
            },
            { status: 409 }
          );
        }
      }
    }

    const modelMap: Record<string, string> = {
      transactions: 'transaction',
      transaction_payments: 'transactionPayment',
      transaction_refunds: 'transactionRefund',
      transaction_status_changes: 'transactionStatusChange',
      customers: 'customer',
      products: 'product',
      prices: 'price',
      shipments: 'shipment',
      employees: 'employee',
      employee_automation_settings: 'employeeAutomationSetting',
      schedules: 'schedule',
      attendance: 'attendance',
      payrolls: 'payroll',
      thirteenth_month_pay_records: 'thirteenthMonthPayRecord',
      salary_history: 'salaryHistory',
      leave_requests: 'leaveRequest',
      expenses: 'expense',
      cash_advances: 'cashAdvanceRecord',
      cash_advance_deductions: 'cashAdvanceDeduction',
      clothing_accounting_opening_balances: 'clothingAccountingOpeningBalance',
      clothing_accounting_journal_lines: 'clothingAccountingJournalLine',
      clothing_recurring_payment_templates: 'clothingRecurringPaymentTemplate',
      clothing_recurring_payment_drafts: 'clothingRecurringPaymentDraft',
      clothing_inventory_reclass_entries: 'clothingInventoryReclassEntry',
      clothing_inventory_transit_build_entries:
        'clothingInventoryTransitBuildEntry',
      invoices: 'invoice',
      checkout_links: 'checkoutLink',
      item_weights: 'itemWeight',

      general_merchandise_transactions: 'generalMerchandiseTransaction',
      general_merchandise_transaction_payments:
        'generalMerchandiseTransactionPayment',
      general_merchandise_transaction_refunds:
        'generalMerchandiseTransactionRefund',
      general_merchandise_transaction_status_changes:
        'generalMerchandiseTransactionStatusChange',
      general_merchandise_customers: 'generalMerchandiseCustomer',
      general_merchandise_products: 'generalMerchandiseProduct',
      general_merchandise_prices: 'generalMerchandisePrice',
      general_merchandise_shipments: 'generalMerchandiseShipment',
      general_merchandise_employees: 'generalMerchandiseEmployee',
      general_merchandise_employee_automation_settings:
        'generalMerchandiseEmployeeAutomationSetting',
      general_merchandise_schedules: 'generalMerchandiseSchedule',
      general_merchandise_attendance: 'generalMerchandiseAttendance',
      general_merchandise_payrolls: 'generalMerchandisePayroll',
      general_merchandise_thirteenth_month_pay_records:
        'generalMerchandiseThirteenthMonthPayRecord',
      general_merchandise_salary_history: 'generalMerchandiseSalaryHistory',
      general_merchandise_leave_requests: 'generalMerchandiseLeaveRequest',
      general_merchandise_expenses: 'generalMerchandiseExpense',
      general_merchandise_cash_advances: 'generalMerchandiseCashAdvanceRecord',
      general_merchandise_cash_advance_deductions:
        'generalMerchandiseCashAdvanceDeduction',
      general_merchandise_accounting_opening_balances:
        'generalMerchandiseAccountingOpeningBalance',
      general_merchandise_accounting_journal_lines:
        'generalMerchandiseAccountingJournalLine',
      general_merchandise_recurring_payment_templates:
        'generalMerchandiseRecurringPaymentTemplate',
      general_merchandise_recurring_payment_drafts:
        'generalMerchandiseRecurringPaymentDraft',
      general_merchandise_invoices: 'generalMerchandiseInvoice',
      general_merchandise_checkout_links: 'generalMerchandiseCheckoutLink',
      general_merchandise_item_weights: 'generalMerchandiseItemWeight',
    };

    const results: Record<
      string,
      {
        count: number;
        updated?: number;
        error?: string;
        beforeCount?: number;
        afterCount?: number;
        attempted?: number;
        skipped?: number;
      }
    > = {};
    const previewResults: Record<string, PreviewTableResult> = {};
    const requestedTablesRaw = tables ?? Object.keys(backupData.tables);

    if (!Array.isArray(requestedTablesRaw)) {
      return NextResponse.json(
        { success: false, error: 'Invalid tables payload' },
        { status: 400 }
      );
    }

    const requestedTables = Array.from(
      new Set(
        requestedTablesRaw
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.trim())
          .filter((value) => value.length > 0)
      )
    );

    if (!requestedTables.length) {
      return NextResponse.json(
        { success: false, error: 'No tables selected for restore' },
        { status: 400 }
      );
    }

    const unknownTables = requestedTables.filter(
      (tableName) => !modelMap[tableName]
    );
    if (unknownTables.length) {
      return NextResponse.json(
        {
          success: false,
          error: `Unknown tables requested: ${unknownTables.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const tablesToRestore = sortTablesForRestore(requestedTables);

    if (previewOnly) {
      for (const tableName of tablesToRestore) {
        const tableData = backupData.tables[tableName];

        if (!tableData || !Array.isArray(tableData.data)) {
          previewResults[tableName] = {
            attempted: 0,
            inserts: [],
            updates: [],
            skipped: 0,
            notice: 'No data to preview',
          };
          continue;
        }

        if (tableData.data.length === 0) {
          previewResults[tableName] = {
            attempted: 0,
            inserts: [],
            updates: [],
            skipped: 0,
            notice: 'No data to restore',
          };
          continue;
        }

        try {
          const modelName = modelMap[tableName];
          const modelDelegate = getModelDelegate(prisma, modelName);
          previewResults[tableName] = await processTablePreview(
            modelDelegate,
            { data: tableData.data },
            forceOverwrite
          );
        } catch (error) {
          previewResults[tableName] = {
            attempted: tableData.data.length,
            inserts: [],
            updates: [],
            skipped: 0,
            notice:
              error instanceof Error
                ? error.message
                : 'Failed to generate preview',
          };
        }
      }

      return NextResponse.json({
        success: true,
        preview: previewResults,
      });
    }

    if (shouldAbortOnError) {
      let abortedAt: string | null = null;

      try {
        await prisma.$transaction(async (tx) => {
          for (const tableName of tablesToRestore) {
            const tableData = backupData.tables?.[tableName];

            if (!tableData || !Array.isArray(tableData.data)) {
              results[tableName] = { count: 0, error: 'No data to restore' };
              abortedAt = tableName;
              throw new Error('Restore aborted due to invalid table data');
            }

            if (tableData.data.length === 0) {
              results[tableName] = { count: 0, error: 'No data to restore' };
              continue;
            }

            try {
              const modelName = modelMap[tableName];
              const txDelegate = getModelDelegate(tx, modelName);
              results[tableName] = await processTableRestore(
                txDelegate,
                modelName,
                { data: tableData.data },
                forceOverwrite
              );
            } catch (error) {
              results[tableName] = {
                count: 0,
                error: error instanceof Error ? error.message : String(error),
              };
              abortedAt = tableName;
              throw error;
            }
          }
        });
      } catch (error) {
        return NextResponse.json(
          {
            success: false,
            message: 'Restore aborted due to table restore error',
            abortedAt,
            results,
            error: error instanceof Error ? error.message : String(error),
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Restore completed',
        results,
      });
    }

    for (const tableName of tablesToRestore) {
      const tableData = backupData.tables[tableName];

      if (
        !tableData ||
        !Array.isArray(tableData.data) ||
        tableData.data.length === 0
      ) {
        results[tableName] = { count: 0, error: 'No data to restore' };
        continue;
      }

      const modelName = modelMap[tableName];
      const tableRows = tableData.data;
      if (!modelName) {
        results[tableName] = { count: 0, error: 'Unknown table' };
        if (shouldAbortOnError) {
          return NextResponse.json(
            {
              success: false,
              message: 'Restore aborted due to unknown table',
              abortedAt: tableName,
              results,
            },
            { status: 400 }
          );
        }
        continue;
      }

      try {
        results[tableName] = await prisma.$transaction(async (tx) => {
          const txDelegate = getModelDelegate(tx, modelName);
          return processTableRestore(
            txDelegate,
            modelName,
            { data: tableRows },
            forceOverwrite
          );
        });
      } catch (error) {
        if (previewOnly) {
          previewResults[tableName] = {
            attempted: tableRows.length,
            inserts: [],
            updates: [],
            skipped: 0,
            notice:
              error instanceof Error
                ? error.message
                : 'Failed to generate preview',
          };
        } else {
          results[tableName] = {
            count: 0,
            error: error instanceof Error ? error.message : String(error),
          };

          if (shouldAbortOnError) {
            return NextResponse.json(
              {
                success: false,
                message: 'Restore aborted due to table restore error',
                abortedAt: tableName,
                results,
              },
              { status: 500 }
            );
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Restore completed',
      results,
    });
  } catch (error) {
    logger.error('Restore failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Restore failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  } finally {
    if (lockAcquired) {
      activeRestoreMutexes.delete(RESTORE_MUTEX_KEY);
    }
    await prisma.$disconnect();
  }
}

// GET - Get soft-deleted records for restoration
export async function GET(request: NextRequest) {
  const authError = await requireBackupRestoreAdmin();
  if (authError) {
    return authError;
  }

  try {
    const { searchParams } = new URL(request.url);
    const table = searchParams.get('table');
    const date = searchParams.get('date');

    if (!table) {
      return NextResponse.json(
        { success: false, error: 'Table parameter required' },
        { status: 400 }
      );
    }

    const modelMap: Record<string, string> = {
      transactions: 'transaction',
      transaction_payments: 'transactionPayment',
      transaction_refunds: 'transactionRefund',
      customers: 'customer',
      products: 'product',
      prices: 'price',
      shipments: 'shipment',
      employees: 'employee',
      schedules: 'schedule',
      attendance: 'attendance',
      payrolls: 'payroll',
      invoices: 'invoice',
      checkout_links: 'checkoutLink',
      item_weights: 'itemWeight',

      general_merchandise_transactions: 'generalMerchandiseTransaction',
      general_merchandise_transaction_payments:
        'generalMerchandiseTransactionPayment',
      general_merchandise_transaction_refunds:
        'generalMerchandiseTransactionRefund',
      general_merchandise_customers: 'generalMerchandiseCustomer',
      general_merchandise_products: 'generalMerchandiseProduct',
      general_merchandise_prices: 'generalMerchandisePrice',
      general_merchandise_shipments: 'generalMerchandiseShipment',
      general_merchandise_employees: 'generalMerchandiseEmployee',
      general_merchandise_schedules: 'generalMerchandiseSchedule',
      general_merchandise_attendance: 'generalMerchandiseAttendance',
      general_merchandise_payrolls: 'generalMerchandisePayroll',
      general_merchandise_invoices: 'generalMerchandiseInvoice',
      general_merchandise_checkout_links: 'generalMerchandiseCheckoutLink',
      general_merchandise_item_weights: 'generalMerchandiseItemWeight',
    };

    const modelName = modelMap[table];
    if (!modelName) {
      return NextResponse.json(
        { success: false, error: 'Unknown table' },
        { status: 400 }
      );
    }

    const where: { deletedAt: { not: null; gte?: Date } } = {
      deletedAt: { not: null },
    };

    if (date) {
      const parsedDate = new Date(date);
      if (Number.isNaN(parsedDate.getTime())) {
        return NextResponse.json(
          { success: false, error: 'Invalid date parameter' },
          { status: 400 }
        );
      }
      where.deletedAt.gte = parsedDate;
    }

    const modelDelegate = getModelDelegate(prisma, modelName);
    const supportsDeletedAt = await ensureModelSupportsDeletedAt(
      modelDelegate,
      table
    );
    if (!supportsDeletedAt.ok) {
      return NextResponse.json(
        {
          success: false,
          error: 'Table does not support soft-delete restore',
          details: supportsDeletedAt.error,
        },
        { status: 400 }
      );
    }

    const deletedRecords = await modelDelegate.findMany({
      where,
      orderBy: { deletedAt: 'desc' },
      take: 100, // Limit to 100 records
    });

    return NextResponse.json({
      success: true,
      table,
      count: deletedRecords.length,
      records: deletedRecords,
    });
  } catch (error) {
    logger.error('Failed to get deleted records:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get deleted records',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// PATCH - Restore soft-deleted records
export async function PATCH(request: NextRequest) {
  const authError = await requireBackupRestoreAdmin();
  if (authError) {
    return authError;
  }

  try {
    const body = (await request.json()) as {
      table?: string;
      ids?: Array<number | string>;
    };
    const { table, ids } = body;

    if (!table || !ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing table or ids parameter' },
        { status: 400 }
      );
    }

    if (
      ids.some(
        (value) =>
          (typeof value !== 'number' && typeof value !== 'string') ||
          `${value}`.trim() === ''
      )
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid ids parameter' },
        { status: 400 }
      );
    }

    const modelMap: Record<string, string> = {
      transactions: 'transaction',
      transaction_payments: 'transactionPayment',
      transaction_refunds: 'transactionRefund',
      customers: 'customer',
      products: 'product',
      prices: 'price',
      shipments: 'shipment',
      employees: 'employee',
      schedules: 'schedule',
      attendance: 'attendance',
      payrolls: 'payroll',
      invoices: 'invoice',
      checkout_links: 'checkoutLink',
      item_weights: 'itemWeight',

      general_merchandise_transactions: 'generalMerchandiseTransaction',
      general_merchandise_transaction_payments:
        'generalMerchandiseTransactionPayment',
      general_merchandise_transaction_refunds:
        'generalMerchandiseTransactionRefund',
      general_merchandise_customers: 'generalMerchandiseCustomer',
      general_merchandise_products: 'generalMerchandiseProduct',
      general_merchandise_prices: 'generalMerchandisePrice',
      general_merchandise_shipments: 'generalMerchandiseShipment',
      general_merchandise_employees: 'generalMerchandiseEmployee',
      general_merchandise_schedules: 'generalMerchandiseSchedule',
      general_merchandise_attendance: 'generalMerchandiseAttendance',
      general_merchandise_payrolls: 'generalMerchandisePayroll',
      general_merchandise_invoices: 'generalMerchandiseInvoice',
      general_merchandise_checkout_links: 'generalMerchandiseCheckoutLink',
      general_merchandise_item_weights: 'generalMerchandiseItemWeight',
    };

    const modelName = modelMap[table];
    if (!modelName) {
      return NextResponse.json(
        { success: false, error: 'Unknown table' },
        { status: 400 }
      );
    }

    const modelDelegate = getModelDelegate(prisma, modelName);
    const supportsDeletedAt = await ensureModelSupportsDeletedAt(
      modelDelegate,
      table
    );
    if (!supportsDeletedAt.ok) {
      return NextResponse.json(
        {
          success: false,
          error: 'Table does not support soft-delete restore',
          details: supportsDeletedAt.error,
        },
        { status: 400 }
      );
    }

    const result = await modelDelegate.updateMany({
      where: { id: { in: ids } },
      data: { deletedAt: null },
    });

    return NextResponse.json({
      success: true,
      message: `Restored ${result.count} records`,
      count: result.count,
    });
  } catch (error) {
    logger.error('Failed to restore records:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to restore records',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
