/**
 * Invoice Settings API
 *
 * GET - Retrieve invoice generation settings
 * POST - Update invoice generation settings
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface InvoiceSettings {
  format: 'pdf' | 'png';
  pngQuality: number;
}

const SETTINGS_FILE = path.join(
  process.cwd(),
  'settings',
  'invoice-settings.json'
);

// Default settings
const DEFAULT_SETTINGS: InvoiceSettings = {
  format: 'png',
  pngQuality: 8,
};

/**
 * GET - Retrieve invoice settings
 */
export async function GET() {
  try {
    // Ensure settings directory exists
    const settingsDir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(settingsDir)) {
      fs.mkdirSync(settingsDir, { recursive: true });
    }

    // Read settings file or return defaults
    if (fs.existsSync(SETTINGS_FILE)) {
      const fileContent = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const settings = JSON.parse(fileContent) as InvoiceSettings;

      return NextResponse.json({
        success: true,
        settings,
      });
    }

    // Return default settings if file doesn't exist
    return NextResponse.json({
      success: true,
      settings: DEFAULT_SETTINGS,
    });
  } catch (error) {
    logger.error('Failed to retrieve invoice settings:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to retrieve invoice settings',
        settings: DEFAULT_SETTINGS,
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Update invoice settings
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { format, pngQuality } = body as InvoiceSettings;

    // Validate settings
    if (!format || (format !== 'pdf' && format !== 'png')) {
      return NextResponse.json(
        { success: false, error: 'Invalid format. Must be "pdf" or "png"' },
        { status: 400 }
      );
    }

    if (
      format === 'png' &&
      (typeof pngQuality !== 'number' || pngQuality < 1 || pngQuality > 10)
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid PNG quality. Must be between 1-10' },
        { status: 400 }
      );
    }

    const settings: InvoiceSettings = {
      format,
      pngQuality: format === 'png' ? pngQuality : DEFAULT_SETTINGS.pngQuality,
    };

    // Ensure settings directory exists
    const settingsDir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(settingsDir)) {
      fs.mkdirSync(settingsDir, { recursive: true });
    }

    // Write settings to file
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');

    logger.info('Invoice settings updated:', settings);

    return NextResponse.json({
      success: true,
      message: 'Invoice settings updated successfully',
      settings,
    });
  } catch (error) {
    logger.error('Failed to update invoice settings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update invoice settings' },
      { status: 500 }
    );
  }
}
