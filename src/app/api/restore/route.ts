/**
 * Restore API Route
 *
 * Handles database restore operations from backups
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { isDeepStrictEqual } from 'util';
import { prisma } from '@/lib/db';
import fs from 'fs';
import path from 'path';
import { logger } from '@/lib/logger';
import { sortTablesForRestore } from './restore-order';
const BACKUP_DIR = path.resolve(process.cwd(), 'backups');
const TIMESTAMP_FOLDER_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/;

const isSafeFilename = (filename: string) => {
  if (!filename) {
    return false;
  }

  if (
    filename.includes('..') ||
    filename.includes('/') ||
    filename.includes('\\')
  ) {
    return false;
  }

  return true;
};

type RowRecord = Record<string, unknown>;

const FIELDS_TO_IGNORE_IN_COMPARISON = new Set(['id', 'updatedAt']);

const PREVIEW_SAMPLE_LIMIT = 200;
const FIND_MANY_CHUNK_SIZE = 2000;
const CREATE_MANY_CHUNK_SIZE = 1000;

const chunkArray = <T>(items: T[], chunkSize: number) => {
  if (chunkSize <= 0) {
    return [items];
  }
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
};

const ensureModelSupportsDeletedAt = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  modelDelegate: any,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  modelDelegate: any,
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

    for (const row of rows as RowRecord[]) {
      const id = row.id as number | string | undefined;
      if (id !== undefined && id !== null) {
        map.set(id, row);
      }
    }
  }

  return map;
};

const normalizeValue = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item));
  }

  if (typeof value === 'object') {
    const serializable = value as { toJSON?: () => unknown };
    if (typeof serializable.toJSON === 'function') {
      return serializable.toJSON();
    }

    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) => [
        key,
        normalizeValue(val),
      ])
    );
  }

  return value;
};

const normalizeRecord = (record: RowRecord): RowRecord =>
  Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, normalizeValue(value)])
  );

const recordsMatch = (
  existing: RowRecord,
  incoming: RowRecord,
  ignoreFields = FIELDS_TO_IGNORE_IN_COMPARISON
) => {
  const keysToCompare = Object.keys(incoming).filter(
    (key) => !ignoreFields.has(key)
  );

  const existingSubset = Object.fromEntries(
    keysToCompare.map((key) => [key, existing[key]])
  );
  const incomingSubset = Object.fromEntries(
    keysToCompare.map((key) => [key, incoming[key]])
  );

  return isDeepStrictEqual(
    normalizeRecord(existingSubset),
    normalizeRecord(incomingSubset)
  );
};

const getChangedFields = (
  existing: RowRecord,
  incoming: RowRecord,
  ignoreFields = FIELDS_TO_IGNORE_IN_COMPARISON
) => {
  const keysToCompare = Object.keys(incoming).filter(
    (key) => !ignoreFields.has(key)
  );

  return Object.fromEntries(
    keysToCompare
      .map((key) => {
        if (
          isDeepStrictEqual(existing[key], incoming[key]) ||
          (existing[key] === undefined && incoming[key] === undefined)
        ) {
          return null;
        }
        return [
          key,
          {
            before: existing[key] ?? null,
            after: incoming[key] ?? null,
          },
        ];
      })
      .filter(Boolean) as Array<[string, { before: unknown; after: unknown }]>
  );
};

const processTablePreview = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  modelDelegate: any,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  modelDelegate: any,
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
  try {
    const body = await request.json();
    const {
      timestamp,
      file,
      tables,
      forceOverwrite = false,
      previewOnly = false,
      stopOnError = true,
    } = body;

    const shouldAbortOnError = stopOnError && !previewOnly;

    if (!timestamp || !file) {
      return NextResponse.json(
        { success: false, error: 'Missing timestamp or file parameter' },
        { status: 400 }
      );
    }

    if (!TIMESTAMP_FOLDER_REGEX.test(timestamp)) {
      return NextResponse.json(
        { success: false, error: 'Invalid timestamp format' },
        { status: 400 }
      );
    }

    if (!isSafeFilename(file)) {
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

    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

    if (!backupData.tables) {
      return NextResponse.json(
        { success: false, error: 'Invalid backup file format' },
        { status: 400 }
      );
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
    const requestedTables = (tables ||
      Object.keys(backupData.tables)) as string[];
    const tablesToRestore = sortTablesForRestore(requestedTables);

    for (const tableName of tablesToRestore) {
      const tableData = backupData.tables[tableName];

      if (!tableData || !tableData.data || tableData.data.length === 0) {
        results[tableName] = { count: 0, error: 'No data to restore' };
        continue;
      }

      const modelName = modelMap[tableName];
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
        // Dynamic model access requires 'any' type due to Prisma's runtime model resolution
        // The modelName is validated against modelMap above
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const modelDelegate = (prisma as any)[modelName];

        if (previewOnly) {
          previewResults[tableName] = await processTablePreview(
            modelDelegate,
            tableData,
            forceOverwrite
          );
          continue;
        }

        results[tableName] = await prisma.$transaction(async (tx) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const txDelegate = (tx as any)[modelName];
          return processTableRestore(
            txDelegate,
            modelName,
            tableData,
            forceOverwrite
          );
        });
      } catch (error) {
        if (previewOnly) {
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

    if (previewOnly) {
      return NextResponse.json({
        success: true,
        preview: previewResults,
      });
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
    await prisma.$disconnect();
  }
}

// GET - Get soft-deleted records for restoration
export async function GET(request: NextRequest) {
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
      where.deletedAt.gte = new Date(date);
    }

    // Dynamic model access requires 'any' type due to Prisma's runtime model resolution
    // The modelName is validated against modelMap above
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const modelDelegate = (prisma as any)[modelName];
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
  try {
    const body = await request.json();
    const { table, ids } = body;

    if (!table || !ids || !Array.isArray(ids)) {
      return NextResponse.json(
        { success: false, error: 'Missing table or ids parameter' },
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

    // Dynamic model access requires 'any' type due to Prisma's runtime model resolution
    // The modelName is validated against modelMap above
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const modelDelegate = (prisma as any)[modelName];
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
