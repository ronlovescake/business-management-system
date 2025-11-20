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
const BACKUP_DIR = path.resolve(process.cwd(), 'backups');

type RowRecord = Record<string, unknown>;

const FIELDS_TO_IGNORE_IN_COMPARISON = new Set(['id', 'updatedAt']);

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

// POST - Restore from backup
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { timestamp, file, tables, forceOverwrite = false } = body;

    if (!timestamp || !file) {
      return NextResponse.json(
        { success: false, error: 'Missing timestamp or file parameter' },
        { status: 400 }
      );
    }

    const backupPath = path.join(BACKUP_DIR, timestamp, file);

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
      customers: 'customer',
      products: 'product',
      prices: 'price',
      shipments: 'shipment',
      employees: 'employee',
      schedules: 'schedule',
      attendance: 'attendance',
      payrolls: 'payroll',
      leave_requests: 'leaveRequest',
      expenses: 'expense',
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
    const tablesToRestore = tables || Object.keys(backupData.tables);

    for (const tableName of tablesToRestore) {
      const tableData = backupData.tables[tableName];

      if (!tableData || !tableData.data || tableData.data.length === 0) {
        results[tableName] = { count: 0, error: 'No data to restore' };
        continue;
      }

      const modelName = modelMap[tableName];
      if (!modelName) {
        results[tableName] = { count: 0, error: 'Unknown table' };
        continue;
      }

      try {
        // Dynamic model access requires 'any' type due to Prisma's runtime model resolution
        // The modelName is validated against modelMap above
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const modelDelegate = (prisma as any)[modelName];

        const beforeCount = await modelDelegate.count();

        if (forceOverwrite) {
          await modelDelegate.deleteMany({});
          const createdResult = await modelDelegate.createMany({
            data: tableData.data,
            skipDuplicates: false,
          });
          const afterCount = await modelDelegate.count();

          results[tableName] = {
            count: createdResult.count,
            updated: 0,
            beforeCount,
            afterCount,
            attempted: tableData.data.length,
            skipped: 0,
          };
          continue;
        }

        const { created, updated, skipped } = await prisma.$transaction(
          async (tx) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const transactionalDelegate = (tx as any)[modelName];
            let createdCount = 0;
            let updatedCount = 0;
            let skippedCount = 0;

            for (const rawRecord of tableData.data as RowRecord[]) {
              const record = { ...rawRecord };
              const recordId = record.id as number | string | null | undefined;

              if (recordId === null || recordId === undefined) {
                await transactionalDelegate.create({ data: record });
                createdCount++;
                continue;
              }

              const existing = await transactionalDelegate.findUnique({
                where: { id: recordId },
              });

              if (!existing) {
                await transactionalDelegate.create({ data: record });
                createdCount++;
                continue;
              }

              if (recordsMatch(existing as RowRecord, record)) {
                skippedCount++;
                continue;
              }

              const dataToUpdate = { ...record };
              delete dataToUpdate.id;
              delete dataToUpdate.updatedAt;

              await transactionalDelegate.update({
                where: { id: recordId },
                data: dataToUpdate,
              });
              updatedCount++;
            }

            return {
              created: createdCount,
              updated: updatedCount,
              skipped: skippedCount,
            };
          }
        );

        const afterCount = await modelDelegate.count();

        results[tableName] = {
          count: created,
          updated,
          beforeCount,
          afterCount,
          attempted: tableData.data.length,
          skipped,
        };
      } catch (error) {
        results[tableName] = {
          count: 0,
          error: error instanceof Error ? error.message : String(error),
        };
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
      customers: 'customer',
      products: 'product',
      prices: 'price',
      shipments: 'shipment',
      employees: 'employee',
      schedules: 'schedule',
      attendance: 'attendance',
      payrolls: 'payroll',
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
    const deletedRecords = await (prisma as any)[modelName].findMany({
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
      customers: 'customer',
      products: 'product',
      prices: 'price',
      shipments: 'shipment',
      employees: 'employee',
      schedules: 'schedule',
      attendance: 'attendance',
      payrolls: 'payroll',
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
    const result = await (prisma as any)[modelName].updateMany({
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
