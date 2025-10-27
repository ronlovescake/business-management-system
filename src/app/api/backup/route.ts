/**
 * Backup API Route
 *
 * Handles database backup operations with multiple formats
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { prisma } from '@/lib/db';
import { getDatabaseUrl } from '@/lib/env';
import fs from 'fs';
import path from 'path';
import { logger } from '@/lib/logger';

const execAsync = promisify(exec);

const BACKUP_DIR = path.resolve(process.cwd(), 'backups');

// Tables to backup
const TABLES = [
  { name: 'transactions', model: 'transaction' },
  { name: 'customers', model: 'customer' },
  { name: 'products', model: 'product' },
  { name: 'prices', model: 'price' },
  { name: 'shipments', model: 'shipment' },
  { name: 'sorting_distributions', model: 'sortingDistribution' },
  { name: 'employees', model: 'employee' },
  { name: 'schedules', model: 'schedule' },
  { name: 'attendance', model: 'attendance' },
  { name: 'payrolls', model: 'payroll' },
  { name: 'leave_requests', model: 'leaveRequest' },
  { name: 'expenses', model: 'expense' },
];

function parseDatabaseUrl() {
  const dbUrl = getDatabaseUrl();
  if (!dbUrl) {
    throw new Error('DATABASE_URL not found');
  }

  const match = dbUrl.match(
    /postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/
  );
  if (!match) {
    throw new Error('Invalid DATABASE_URL format');
  }

  const [, user, password, host, port, database] = match;
  return { user, password, host, port, database };
}

function ensureBackupDir(timestamp: string) {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const timestampDir = path.join(BACKUP_DIR, timestamp);
  if (!fs.existsSync(timestampDir)) {
    fs.mkdirSync(timestampDir, { recursive: true });
  }

  return timestampDir;
}

// POST - Create backup
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { format = 'json', includeSoftDeleted = false } = body;

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, -5);
    const backupDir = ensureBackupDir(timestamp);

    let backupFile = '';
    const files: string[] = [];

    // JSON Backup
    if (format === 'json' || format === 'all') {
      const backup: Record<string, unknown> = {
        metadata: {
          createdAt: new Date().toISOString(),
          database: parseDatabaseUrl().database,
          format: 'json',
          version: '1.0',
          includeSoftDeleted,
        },
        tables: {},
      };

      for (const { name, model } of TABLES) {
        try {
          // Dynamic model access requires 'any' type due to Prisma's runtime model resolution
          // The model name is validated against TABLES array above
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const modelDelegate = prisma[model as keyof typeof prisma] as any;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sampleRecord = await modelDelegate.findFirst();
          const hasDeletedAt = sampleRecord && 'deletedAt' in sampleRecord;

          const where =
            hasDeletedAt && !includeSoftDeleted ? { deletedAt: null } : {};

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = await modelDelegate.findMany({ where });

          (backup.tables as Record<string, unknown>)[name] = {
            count: data.length,
            data: data,
          };
        } catch (error) {
          (backup.tables as Record<string, unknown>)[name] = {
            count: 0,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }

      backupFile = path.join(backupDir, `backup-${timestamp}.json`);
      fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
      files.push(backupFile);
    }

    // SQL Backup
    if (format === 'sql' || format === 'all') {
      try {
        const { user, password, host, port, database } = parseDatabaseUrl();
        const sqlFile = path.join(backupDir, `backup-${timestamp}.sql`);

        const command = `PGPASSWORD="${password}" pg_dump -h ${host} -p ${port} -U ${user} -d ${database} -F p -f "${sqlFile}"`;

        await execAsync(command);
        files.push(sqlFile);
        backupFile = sqlFile;
      } catch (error) {
        logger.error('SQL backup failed:', error);
        // Continue with JSON backup if SQL fails
      }
    }

    // Create manifest
    const manifest = {
      timestamp: new Date().toISOString(),
      database: parseDatabaseUrl().database,
      format: format,
      files: files.map((file) => ({
        name: path.basename(file),
        size: fs.statSync(file).size,
        path: path.relative(BACKUP_DIR, file),
      })),
    };

    const manifestFile = path.join(backupDir, 'MANIFEST.json');
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));

    const totalSize = files.reduce((sum, file) => {
      return sum + fs.statSync(file).size;
    }, 0);

    return NextResponse.json({
      success: true,
      message: 'Backup created successfully',
      backup: {
        timestamp,
        path: backupDir,
        files: files.map((f) => path.basename(f)),
        totalSize,
        format,
      },
    });
  } catch (error) {
    logger.error('Backup failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Backup failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// GET - List available backups
export async function GET() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      return NextResponse.json({ success: true, backups: [] });
    }

    const backupFolders = fs
      .readdirSync(BACKUP_DIR)
      .filter((name) => {
        const fullPath = path.join(BACKUP_DIR, name);
        return fs.statSync(fullPath).isDirectory();
      })
      .sort()
      .reverse(); // Most recent first

    const backups = backupFolders.map((folder) => {
      const folderPath = path.join(BACKUP_DIR, folder);
      const manifestPath = path.join(folderPath, 'MANIFEST.json');

      let manifest = null;
      if (fs.existsSync(manifestPath)) {
        try {
          manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        } catch {
          // Ignore invalid manifest
        }
      }

      const files = fs.readdirSync(folderPath);
      const totalSize = files.reduce((sum, file) => {
        const filePath = path.join(folderPath, file);
        return sum + fs.statSync(filePath).size;
      }, 0);

      return {
        timestamp: folder,
        path: folderPath,
        files: files,
        totalSize,
        manifest,
      };
    });

    return NextResponse.json({ success: true, backups });
  } catch (error) {
    logger.error('Failed to list backups:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list backups',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete a specific backup
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const timestamp = searchParams.get('timestamp');

    if (!timestamp) {
      return NextResponse.json(
        { success: false, error: 'Timestamp parameter required' },
        { status: 400 }
      );
    }

    const backupPath = path.join(BACKUP_DIR, timestamp);

    if (!fs.existsSync(backupPath)) {
      return NextResponse.json(
        { success: false, error: 'Backup not found' },
        { status: 404 }
      );
    }

    // Delete backup folder recursively
    fs.rmSync(backupPath, { recursive: true, force: true });

    return NextResponse.json({
      success: true,
      message: 'Backup deleted successfully',
    });
  } catch (error) {
    logger.error('Failed to delete backup:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete backup',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
