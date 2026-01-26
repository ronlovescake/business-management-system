/**
 * Backup File Server API Route
 *
 * Serves individual backup files for preview and download
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { logger } from '@/lib/logger';

const BACKUP_DIR = path.resolve(process.cwd(), 'backups');
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { timestamp: string; filename: string } }
) {
  try {
    const { timestamp, filename } = params;
    const url = new URL(request.url);
    const mode = url.searchParams.get('mode');
    const requestedTable = url.searchParams.get('table');
    const rawLimit = url.searchParams.get('limit');
    const rawOffset = url.searchParams.get('offset');

    logger.info('Backup file request:', { timestamp, filename, BACKUP_DIR });

    // Security: Validate timestamp format to prevent directory traversal
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/.test(timestamp)) {
      logger.error('Invalid timestamp format:', timestamp);
      return NextResponse.json(
        { error: 'Invalid timestamp format' },
        { status: 400 }
      );
    }

    // Security: Validate filename to prevent directory traversal
    if (
      filename.includes('..') ||
      filename.includes('/') ||
      filename.includes('\\')
    ) {
      logger.error('Invalid filename:', filename);
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }

    const filePath = path.join(BACKUP_DIR, timestamp, filename);
    logger.info('Attempting to read file:', filePath);

    // Security: Ensure the resolved path is within BACKUP_DIR
    const resolvedPath = path.resolve(filePath);
    const resolvedBackupDir = path.resolve(BACKUP_DIR);
    logger.info('Path resolution:', { resolvedPath, resolvedBackupDir });

    if (!resolvedPath.startsWith(resolvedBackupDir)) {
      logger.error('Access denied - path outside backup dir');
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      logger.error('File not found:', filePath);
      logger.info(
        'Directory contents:',
        fs.readdirSync(path.join(BACKUP_DIR, timestamp))
      );
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Lightweight JSON modes for large backups
    if (
      filename.endsWith('.json') &&
      (mode === 'summary' || mode === 'table')
    ) {
      const maxLimit = 5000;
      const limit = Math.max(
        1,
        Math.min(maxLimit, Number.parseInt(rawLimit || '200', 10) || 200)
      );
      const offset = Math.max(0, Number.parseInt(rawOffset || '0', 10) || 0);

      if (mode === 'table') {
        if (!requestedTable) {
          return NextResponse.json(
            { error: 'Missing table parameter' },
            { status: 400 }
          );
        }

        // Basic validation (tables are JSON keys; still avoid weird inputs)
        if (!/^[a-z0-9_]+$/i.test(requestedTable)) {
          return NextResponse.json(
            { error: 'Invalid table parameter' },
            { status: 400 }
          );
        }
      }

      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw) as {
        metadata?: unknown;
        tables?: Record<string, { count?: number; data?: unknown[] }>;
      };

      const metadata = parsed.metadata;
      const tables = parsed.tables;

      if (!tables || typeof tables !== 'object') {
        return NextResponse.json(
          { error: 'Invalid backup file format' },
          { status: 400 }
        );
      }

      if (mode === 'summary') {
        const summaryPath = path.join(
          BACKUP_DIR,
          timestamp,
          `${filename}.summary.json`
        );
        if (fs.existsSync(summaryPath)) {
          const cached = fs.readFileSync(summaryPath, 'utf8');
          return NextResponse.json(JSON.parse(cached), {
            headers: { 'Cache-Control': 'no-store' },
          });
        }

        const summary = {
          metadata,
          tables: Object.fromEntries(
            Object.entries(tables).map(([name, table]) => [
              name,
              {
                count:
                  typeof table?.count === 'number'
                    ? table.count
                    : Array.isArray(table?.data)
                      ? table.data.length
                      : 0,
              },
            ])
          ),
        };

        try {
          fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
        } catch (error) {
          logger.warn('Failed to write backup summary cache', {
            summaryPath,
            error,
          });
        }

        return NextResponse.json(summary, {
          headers: { 'Cache-Control': 'no-store' },
        });
      }

      // mode === 'table'
      const tableName = requestedTable as string;
      const table = tables[tableName];

      if (!table || !Array.isArray(table.data)) {
        return NextResponse.json({ error: 'Table not found' }, { status: 404 });
      }

      const total =
        typeof table.count === 'number'
          ? table.count
          : (table.data?.length ?? 0);
      const sliced = table.data.slice(offset, offset + limit);

      return NextResponse.json(
        {
          metadata,
          tables: {
            [tableName]: {
              count: total,
              data: sliced,
              sample: {
                offset,
                limit,
                total,
              },
            },
          },
        },
        {
          headers: { 'Cache-Control': 'no-store' },
        }
      );
    }

    // Read the file
    const fileContent = fs.readFileSync(filePath);

    // Determine content type based on file extension
    let contentType = 'application/octet-stream';
    if (filename.endsWith('.json')) {
      contentType = 'application/json';
    } else if (filename.endsWith('.csv')) {
      contentType = 'text/csv';
    } else if (filename.endsWith('.sql')) {
      contentType = 'text/plain';
    }

    // Return the file with appropriate headers
    return new NextResponse(fileContent, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    });
  } catch (error) {
    logger.error('Failed to serve backup file:', error);
    return NextResponse.json(
      {
        error: 'Failed to serve file',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
