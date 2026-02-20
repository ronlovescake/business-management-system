import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db';

// GET: Load distribution data for a product code
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productCode = searchParams.get('productCode');

    logger.debug('📥 GET /api/general-merchandise/sorting-distribution', {
      productCode,
    });

    if (!productCode) {
      return NextResponse.json(
        { error: 'Product code is required' },
        { status: 400 }
      );
    }

    const records = await prisma.generalMerchandiseSortingDistribution.findMany(
      {
        where: {
          productCode,
          deletedAt: null,
        },
        orderBy: {
          rowNumber: 'asc',
        },
      }
    );

    const selectedQuantity = records[0]?.selectedQuantity ?? null;

    const data = records.map((record) => ({
      quantity: record.quantity,
      percentage: record.percentage,
      groupNumber: record.groupNumber,
      distribution: record.distribution,
      checked: record.checked,
    }));

    logger.debug(`Loaded ${data.length} GM distribution rows`, {
      productCode,
    });

    return NextResponse.json({ data, selectedQuantity });
  } catch (error) {
    logger.error('Error loading GM sorting distribution:', error);
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

    logger.debug('💾 POST /api/general-merchandise/sorting-distribution', {
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

    const nonEmptyRows = rows.filter(
      (row) =>
        row.quantity > 0 ||
        row.percentage > 0 ||
        row.groupNumber ||
        row.distribution > 0 ||
        row.checked
    );

    await prisma.$transaction(async (tx) => {
      await tx.generalMerchandiseSortingDistribution.deleteMany({
        where: { productCode },
      });

      if (nonEmptyRows.length > 0) {
        await tx.generalMerchandiseSortingDistribution.createMany({
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

    logger.info('Saved GM sorting distribution data', {
      productCode,
      savedCount: nonEmptyRows.length,
    });

    return NextResponse.json({
      success: true,
      savedCount: nonEmptyRows.length,
      message: `Saved ${nonEmptyRows.length} distribution rows`,
    });
  } catch (error) {
    logger.error('Error saving GM sorting distribution:', error);
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

    logger.debug('🗑️ DELETE /api/general-merchandise/sorting-distribution', {
      productCode,
    });

    if (!productCode) {
      return NextResponse.json(
        { error: 'Product code is required' },
        { status: 400 }
      );
    }

    const result =
      await prisma.generalMerchandiseSortingDistribution.updateMany({
        where: {
          productCode,
          deletedAt: null,
        },
        data: {
          deletedAt: new Date(),
        },
      });

    logger.info('Deleted GM sorting distribution data', {
      productCode,
      deletedCount: result.count,
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
      message: `Deleted ${result.count} distribution rows`,
    });
  } catch (error) {
    logger.error('Error deleting GM sorting distribution:', error);
    return NextResponse.json(
      { error: 'Failed to delete distribution data' },
      { status: 500 }
    );
  }
}
