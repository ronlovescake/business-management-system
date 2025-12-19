/**
 * Transactions Settings API Route
 * Manages transactions page behavior configuration
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

const DEFAULT_MIN_SPARE_ROWS = 50;

/**
 * GET /api/settings/transactions
 *
 * Fetch current transactions settings (creates default if none exists)
 */
export async function GET() {
  try {
    // Try to get existing settings
    let settings = await prisma.transactionsSettings.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    // If no settings exist, create default
    if (!settings) {
      settings = await prisma.transactionsSettings.create({
        data: {
          // scrollToLastNonEmptyRows removed
          minSpareRows: DEFAULT_MIN_SPARE_ROWS,
          unitPriceReadOnly: true,
          lineTotalReadOnly: true,
          invoiceDateReadOnly: true,
          packedDateReadOnly: true,
          shipmentCodeReadOnly: true,
        },
      });
      logger.info('Created default transactions settings');
    }

    return NextResponse.json(settings);
  } catch (error) {
    logger.error('Error fetching transactions settings', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions settings' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings/transactions
 *
 * Update transactions settings
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      // scrollToLastNonEmptyRows removed
      unitPriceReadOnly,
      lineTotalReadOnly,
      invoiceDateReadOnly,
      packedDateReadOnly,
      shipmentCodeReadOnly,
    } = body;

    // Validate scrollToLastNonEmptyRows (0 = disabled, 1-100 = enabled)
    // scrollToLastNonEmptyRows validation removed

    // Get existing settings or create new one
    const existingSettings = await prisma.transactionsSettings.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    let updatedSettings;

    const updateData: {
      // scrollToLastNonEmptyRows removed
      unitPriceReadOnly?: boolean;
      lineTotalReadOnly?: boolean;
      invoiceDateReadOnly?: boolean;
      packedDateReadOnly?: boolean;
      shipmentCodeReadOnly?: boolean;
    } = {};

    // scrollToLastNonEmptyRows removed
    if (unitPriceReadOnly !== undefined) {
      updateData.unitPriceReadOnly = unitPriceReadOnly;
    }
    if (lineTotalReadOnly !== undefined) {
      updateData.lineTotalReadOnly = lineTotalReadOnly;
    }
    if (invoiceDateReadOnly !== undefined) {
      updateData.invoiceDateReadOnly = invoiceDateReadOnly;
    }
    if (packedDateReadOnly !== undefined) {
      updateData.packedDateReadOnly = packedDateReadOnly;
    }
    if (shipmentCodeReadOnly !== undefined) {
      updateData.shipmentCodeReadOnly = shipmentCodeReadOnly;
    }

    if (existingSettings) {
      // Update existing
      updatedSettings = await prisma.transactionsSettings.update({
        where: { id: existingSettings.id },
        data: updateData,
      });
      logger.info('Updated transactions settings', {
        id: existingSettings.id,
        changes: updateData,
      });
    } else {
      // Create new
      updatedSettings = await prisma.transactionsSettings.create({
        data: {
          // scrollToLastNonEmptyRows removed
          minSpareRows: DEFAULT_MIN_SPARE_ROWS,
          unitPriceReadOnly: unitPriceReadOnly ?? true,
          lineTotalReadOnly: lineTotalReadOnly ?? true,
          invoiceDateReadOnly: invoiceDateReadOnly ?? true,
          packedDateReadOnly: packedDateReadOnly ?? true,
          shipmentCodeReadOnly: shipmentCodeReadOnly ?? true,
        },
      });
      logger.info('Created new transactions settings', {
        id: updatedSettings.id,
      });
    }

    return NextResponse.json(updatedSettings);
  } catch (error) {
    logger.error('Error updating transactions settings', error);
    return NextResponse.json(
      { error: 'Failed to update transactions settings' },
      { status: 500 }
    );
  }
}
