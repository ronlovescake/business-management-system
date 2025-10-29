import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { Price } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { sanitizers } from '@/lib/security/sanitize';
import { MAX_QUERY_LIMIT } from '@/constants/batch-sizes';

type PriceDTO = {
  id?: number;
  'Product Code': string;
  'Lower Limit': number;
  'Upper Limit': number;
  Prices: number;
  'Price Adjustment': number;
};

type PriceImportRow = {
  id?: number;
  'Product Code': string;
  'Lower Limit': number | string;
  'Upper Limit': number | string;
  Prices: number | string;
  'Price Adjustment'?: number | string;
};

function mapToDTO(price: Price): PriceDTO {
  return {
    id: price.id,
    'Product Code': price.productCode,
    'Lower Limit': Math.round(price.lowerLimit / 100),
    'Upper Limit': Math.round(price.upperLimit / 100),
    Prices: Math.round(price.currentPrice / 100),
    'Price Adjustment': Math.round(price.priceAdjustment / 100),
  };
}

/**
 * Parse and sanitize numeric field
 */
function parseNumericField(value: number | string | undefined): number {
  return sanitizers.number(value, { min: 0, decimals: 2 }) ?? 0;
}

/**
 * Map and sanitize DTO to Prisma input
 */
function mapFromDTO(dto: PriceImportRow): Prisma.PriceCreateManyInput {
  const adjustment = parseNumericField(dto['Price Adjustment']);
  return {
    productCode: sanitizers.productCode(dto['Product Code']) || '',
    lowerLimit: Math.round(parseNumericField(dto['Lower Limit']) * 100),
    upperLimit: Math.round(parseNumericField(dto['Upper Limit']) * 100),
    currentPrice: Math.round(parseNumericField(dto['Prices']) * 100),
    priceAdjustment: Math.round(adjustment * 100),
    isActive: true,
  };
}

// GET - Fetch all prices (excluding soft-deleted)
export async function GET() {
  try {
    // ========================================================================
    // ⚠️ SOFT DELETE FILTER
    // ========================================================================
    const prices = await prisma.price.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' }, // Newest first
    });

    // Convert database format to UI format
    const formattedPrices = prices.map(mapToDTO);

    return NextResponse.json(formattedPrices);
  } catch (error) {
    logger.error('Failed to fetch prices:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch prices',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// POST - Create multiple prices (for CSV import or adding new prices)
export async function POST(request: NextRequest) {
  try {
    const rawData = await request.json();

    // ========================================================================
    // ⚠️ DATA VALIDATION - Array Format
    // ========================================================================
    if (!Array.isArray(rawData) || rawData.length === 0) {
      return NextResponse.json(
        {
          error: 'Invalid data format',
          details: 'Expected array of price objects',
        },
        { status: 400 }
      );
    }

    const pricesData = rawData as PriceImportRow[];

    // ========================================================================
    // ⚠️ BATCH SIZE LIMIT - Maximum records per import
    // ========================================================================
    if (pricesData.length > MAX_QUERY_LIMIT) {
      logger.warn(
        `Batch size limit exceeded: ${pricesData.length} records (max ${MAX_QUERY_LIMIT})`
      );
      return NextResponse.json(
        {
          error: 'Batch size limit exceeded',
          details: `You are trying to import ${pricesData.length} records. Maximum is ${MAX_QUERY_LIMIT.toLocaleString()} records per import.`,
          suggestion: `Please split your import into smaller batches of ${MAX_QUERY_LIMIT.toLocaleString()} records or less.`,
        },
        { status: 413 } // Payload Too Large
      );
    }

    // ========================================================================
    // ⚠️ IMPORT MODE DETECTION
    // Check if this is a CSV import (large batch) or adding new prices (small batch)
    // CSV imports: delete all first then import
    // Adding prices: just insert/update without deleting
    // ========================================================================
    const isCSVImport = pricesData.length > 10; // CSV imports typically have many records
    
    if (isCSVImport) {
      await prisma.price.deleteMany();
      logger.info(`CSV import mode: cleared existing prices before import`);
    }

    // Filter out empty rows and invalid data
    const validPricesData = pricesData.filter((priceData) => {
      const code = priceData['Product Code'];
      const lower = priceData['Lower Limit'];
      const upper = priceData['Upper Limit'];
      const price = priceData['Prices'];

      return (
        typeof code === 'string' &&
        code.trim() !== '' &&
        lower !== undefined &&
        upper !== undefined &&
        price !== undefined
      );
    });

    logger.debug(
      `Filtered ${validPricesData.length} valid records from ${pricesData.length} total records`
    );

    // Convert UI format to database format and create records sequentially
    // Use createMany for bulk insert which preserves order
    const dataToInsert = validPricesData.map(mapFromDTO);

    // ========================================================================
    // ⚠️ ATOMIC BULK IMPORT - Using upsert/restore pattern
    // ========================================================================
    // Per-record upsert to maintain stable IDs and auto-restore soft-deleted records
    // Unique key: productCode + lowerLimit + upperLimit
    // ========================================================================
    const result = await prisma.$transaction(async (tx) => {
      let created = 0;
      let updated = 0;
      let restored = 0;

      for (const priceData of dataToInsert) {
        // Check if price exists by composite key
        const existing = await tx.price.findFirst({
          where: {
            productCode: priceData.productCode,
            lowerLimit: priceData.lowerLimit,
            upperLimit: priceData.upperLimit,
          },
        });

        if (existing) {
          // Update existing record and restore if soft-deleted
          const wasDeleted = existing.deletedAt !== null;

          await tx.price.update({
            where: { id: existing.id },
            data: {
              ...priceData,
              deletedAt: null, // Auto-restore if soft-deleted
            },
          });

          if (wasDeleted) {
            restored++;
          } else {
            updated++;
          }
        } else {
          // Create new record
          await tx.price.create({
            data: priceData,
          });
          created++;
        }
      }

      return {
        created,
        updated,
        restored,
        total: created + updated + restored,
      };
    });

    logger.info(
      `✅ Imported ${result.total} prices (${result.created} created, ${result.updated} updated, ${result.restored} restored)`
    );

    return NextResponse.json({
      message: `Successfully imported ${result.total} price records`,
      created: result.created,
      updated: result.updated,
      restored: result.restored,
      total: result.total,
      filtered: pricesData.length - validPricesData.length,
    });
  } catch (error) {
    logger.error('Failed to import prices:', error);

    // Enhanced error handling
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2002 = Unique constraint failed
      if (error.code === 'P2002') {
        return NextResponse.json(
          {
            error: 'Duplicate price',
            details: 'A price with this product code and range already exists',
            code: error.code,
          },
          { status: 409 }
        );
      }
      // P2003 = Foreign key constraint failed
      if (error.code === 'P2003') {
        return NextResponse.json(
          {
            error: 'Reference integrity violation',
            details: 'Referenced product does not exist',
            code: error.code,
          },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to import price data to database',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// PUT - Update prices for a specific product code
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productCode = searchParams.get('productCode');

    if (!productCode) {
      return NextResponse.json(
        {
          error: 'Missing product code',
          details: 'Product code is required as query parameter',
        },
        { status: 400 }
      );
    }

    const rawData = await request.json();

    // Validate data format
    if (!Array.isArray(rawData) || rawData.length === 0) {
      return NextResponse.json(
        {
          error: 'Invalid data format',
          details: 'Expected array of price objects',
        },
        { status: 400 }
      );
    }

    const pricesData = rawData as PriceImportRow[];

    // Filter valid data
    const validPricesData = pricesData.filter((priceData) => {
      const code = priceData['Product Code'];
      const lower = priceData['Lower Limit'];
      const upper = priceData['Upper Limit'];
      const price = priceData['Prices'];

      return (
        typeof code === 'string' &&
        code.trim() !== '' &&
        code === productCode && // Ensure product code matches
        lower !== undefined &&
        upper !== undefined &&
        price !== undefined
      );
    });

    if (validPricesData.length === 0) {
      return NextResponse.json(
        {
          error: 'No valid price data',
          details: 'No valid tiers found for the specified product code',
        },
        { status: 400 }
      );
    }

    // Convert to database format
    const dataToInsert = validPricesData.map(mapFromDTO);

    // Update prices for this product code in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Delete existing tiers for this product code
      await tx.price.deleteMany({
        where: { productCode },
      });

      // Insert new tiers
      await tx.price.createMany({
        data: dataToInsert,
      });

      return {
        productCode,
        tiersUpdated: dataToInsert.length,
      };
    });

    logger.info(
      `✅ Updated ${result.tiersUpdated} price tiers for product ${result.productCode}`
    );

    return NextResponse.json({
      message: `Successfully updated ${result.tiersUpdated} price tiers for ${result.productCode}`,
      tiersUpdated: result.tiersUpdated,
      productCode: result.productCode,
    });
  } catch (error) {
    logger.error('Failed to update prices:', error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          {
            error: 'Duplicate price',
            details: 'A price with this product code and range already exists',
            code: error.code,
          },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to update prices',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete all prices (with safety protection)
export async function DELETE(request: NextRequest) {
  try {
    // ========================================================================
    // ⚠️ MASS DELETION PROTECTION
    // ========================================================================
    const { searchParams } = new URL(request.url);
    const confirmParam = searchParams.get('confirm');

    if (confirmParam !== 'DELETE_ALL_PRICES') {
      return NextResponse.json(
        {
          error: 'Mass deletion protection',
          details:
            'You must provide confirmation query parameter to delete all prices',
          required: '?confirm=DELETE_ALL_PRICES',
          example: '/api/prices?confirm=DELETE_ALL_PRICES',
          suggestion:
            'This safety measure prevents accidental deletion of all records.',
        },
        { status: 400 } // Bad Request
      );
    }

    logger.warn('⚠️ Mass deletion requested with confirmation');

    // ========================================================================
    // ⚠️ SOFT DELETE - Mark as deleted instead of hard delete
    // ========================================================================

    // Check how many are already soft-deleted for observability
    const alreadyDeleted = await prisma.price.count({
      where: { deletedAt: { not: null } },
    });

    const result = await prisma.price.updateMany({
      where: { deletedAt: null }, // Only soft-delete active records
      data: {
        deletedAt: new Date(),
      },
    });

    logger.info(
      `✅ Soft deleted ${result.count} prices (${alreadyDeleted} were already deleted)`
    );

    return NextResponse.json({
      message: `Successfully deleted ${result.count} price records`,
      count: result.count,
      note: 'Records are soft-deleted and can be recovered if needed',
    });
  } catch (error) {
    logger.error('Failed to delete prices:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete prices',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
