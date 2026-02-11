/**
 * Backup File Server API Route
 *
 * Serves individual backup files for preview and download
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { parser } from 'stream-json';
import { pick } from 'stream-json/filters/Pick';
import { streamArray } from 'stream-json/streamers/StreamArray';
import { streamValues } from 'stream-json/streamers/StreamValues';
import { logger } from '@/lib/logger';

const BACKUP_DIR = path.resolve(process.cwd(), 'backups');
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const readJsonValue = async (filePath: string, filter: string) => {
  return new Promise<unknown>((resolve, reject) => {
    let settled = false;
    let found = false;
    let value: unknown;

    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(found ? value : undefined);
    };

    const fail = (error: unknown) => {
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    };

    const fileStream = fs.createReadStream(filePath);
    const jsonStream = fileStream
      .pipe(parser())
      .pipe(pick({ filter }))
      .pipe(streamValues());

    jsonStream.on('data', (data: { value: unknown }) => {
      found = true;
      value = data.value;
      fileStream.destroy();
    });

    jsonStream.on('end', finish);
    jsonStream.on('close', finish);
    jsonStream.on('error', fail);
    fileStream.on('error', fail);
  });
};

const readTableSample = async (
  filePath: string,
  tableName: string,
  offset: number,
  limit: number
) => {
  return new Promise<unknown[]>((resolve, reject) => {
    let settled = false;
    const rows: unknown[] = [];
    let index = 0;

    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(rows);
    };

    const fail = (error: unknown) => {
      if (settled) {
        return;
      }
      settled = true;
      reject(error);
    };

    const fileStream = fs.createReadStream(filePath);
    const jsonStream = fileStream
      .pipe(parser())
      .pipe(pick({ filter: `tables.${tableName}.data` }))
      .pipe(streamArray());

    jsonStream.on('data', (data: { value: unknown }) => {
      if (index >= offset && rows.length < limit) {
        rows.push(data.value);
      }
      index += 1;

      if (rows.length >= limit) {
        fileStream.destroy();
      }
    });

    jsonStream.on('end', finish);
    jsonStream.on('close', finish);
    jsonStream.on('error', fail);
    fileStream.on('error', fail);
  });
};

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

        const manifestPath = path.join(BACKUP_DIR, timestamp, 'MANIFEST.json');
        if (fs.existsSync(manifestPath)) {
          try {
            const manifest = JSON.parse(
              fs.readFileSync(manifestPath, 'utf8')
            ) as {
              timestamp?: string;
              database?: string;
              format?: string;
              includeSoftDeleted?: boolean;
              strategy?: string;
              baseTimestamp?: string | null;
              baseFolder?: string | null;
              changeWindow?: { since: string | null; until: string } | null;
              recordCounts?: Record<string, number>;
            };

            if (manifest.recordCounts) {
              const summary = {
                metadata: {
                  createdAt: manifest.timestamp ?? timestamp,
                  database: manifest.database ?? 'unknown',
                  format: manifest.format ?? 'json',
                  version: '1.1',
                  includeSoftDeleted: manifest.includeSoftDeleted ?? false,
                  strategy: manifest.strategy ?? 'full',
                  baseTimestamp: manifest.baseTimestamp ?? null,
                  baseFolder: manifest.baseFolder ?? null,
                  changeWindow: manifest.changeWindow ?? null,
                },
                tables: Object.fromEntries(
                  Object.entries(manifest.recordCounts).map(([name, count]) => [
                    name,
                    { count },
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
          } catch (error) {
            logger.warn('Failed to read manifest for summary', {
              manifestPath,
              error,
            });
          }
        }

        return NextResponse.json(
          {
            error: 'Summary unavailable for this backup file',
          },
          { status: 400 }
        );
      }

      // mode === 'table'
      const tableName = requestedTable as string;
      const metadata = await readJsonValue(filePath, 'metadata');
      const rawCount = await readJsonValue(
        filePath,
        `tables.${tableName}.count`
      );
      const total = typeof rawCount === 'number' ? rawCount : undefined;
      const sliced = await readTableSample(filePath, tableName, offset, limit);

      if (!sliced.length && (total === undefined || total === 0)) {
        return NextResponse.json({ error: 'Table not found' }, { status: 404 });
      }

      const resolvedTotal = total ?? sliced.length;

      return NextResponse.json(
        {
          metadata,
          tables: {
            [tableName]: {
              count: resolvedTotal,
              data: sliced,
              sample: {
                offset,
                limit,
                total: resolvedTotal,
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
