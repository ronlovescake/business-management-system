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
