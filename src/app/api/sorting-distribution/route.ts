import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';

// GET: Load distribution data for a product code
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productCode = searchParams.get('productCode');

    logger.debug('📥 GET /api/sorting-distribution', { productCode });

    if (!productCode) {
      return NextResponse.json(
        { error: 'Product code is required' },
        { status: 400 }
      );
    }

    // Load saved distribution data
    const records = await prisma.sortingDistribution.findMany({
      where: {
        productCode,
        deletedAt: null,
      },
      orderBy: {
        rowNumber: 'asc',
      },
    });

    // Get selected quantity from the first record (if any)
    const selectedQuantity = records[0]?.selectedQuantity ?? null;

    // Convert database records to distribution rows
    const data = records.map((record) => ({
      quantity: record.quantity,
      percentage: record.percentage,
      groupNumber: record.groupNumber,
      distribution: record.distribution,
      checked: record.checked,
    }));

    logger.debug(`Loaded ${data.length} distribution rows`, { productCode });

    return NextResponse.json({ data, selectedQuantity });
  } catch (error) {
    logger.error('Error loading sorting distribution:', error);
    return NextResponse.json(
      { error: 'Failed to load distribution data' },
      { status: 500 }
    );
  }
}

// POST: Save distribution data
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { productCode, selectedQuantity, rows } = body;

    logger.debug('💾 POST /api/sorting-distribution', {
      productCode,
      selectedQuantity,
      rowCount: rows?.length,
    });

    if (!productCode || !Array.isArray(rows)) {
      return NextResponse.json(
        { error: 'Product code and rows are required' },
        { status: 400 }
      );
    }

    // Filter out empty rows (rows with no data)
    const nonEmptyRows = rows.filter(
      (row) =>
        row.quantity > 0 ||
        row.percentage > 0 ||
        row.groupNumber ||
        row.distribution > 0 ||
        row.checked
    );

    // Use a transaction to delete and create atomically
    await prisma.$transaction(async (tx) => {
      // Hard delete existing records (bypass soft delete middleware)
      // Use proper column name with quotes for snake_case
      await tx.$executeRawUnsafe(
        `DELETE FROM sorting_distributions WHERE "productCode" = $1`,
        productCode
      );

      // Create new records
      if (nonEmptyRows.length > 0) {
        await tx.sortingDistribution.createMany({
          data: nonEmptyRows.map((row, index) => ({
            productCode,
            selectedQuantity,
            rowNumber: index,
            quantity: row.quantity || 0,
            percentage: row.percentage || 0,
            groupNumber: row.groupNumber || '',
            distribution: row.distribution || 0,
            checked: row.checked || false,
          })),
        });
      }
    });

    logger.info('Saved sorting distribution data', {
      productCode,
      savedCount: nonEmptyRows.length,
    });

    return NextResponse.json({
      success: true,
      savedCount: nonEmptyRows.length,
      message: `Saved ${nonEmptyRows.length} distribution rows`,
    });
  } catch (error) {
    logger.error('Error saving sorting distribution:', error);
    return NextResponse.json(
      { error: 'Failed to save distribution data' },
      { status: 500 }
    );
  }
}

// DELETE: Clear distribution data for a product code
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productCode = searchParams.get('productCode');

    logger.debug('🗑️ DELETE /api/sorting-distribution', { productCode });

    if (!productCode) {
      return NextResponse.json(
        { error: 'Product code is required' },
        { status: 400 }
      );
    }

    // Soft delete by setting deletedAt
    const result = await prisma.sortingDistribution.updateMany({
      where: {
        productCode,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    logger.info('Deleted sorting distribution data', {
      productCode,
      deletedCount: result.count,
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      message: `Deleted ${result.count} distribution rows`,
    });
  } catch (error) {
    logger.error('Error deleting sorting distribution:', error);
    return NextResponse.json(
      { error: 'Failed to delete distribution data' },
      { status: 500 }
    );
  }
}
