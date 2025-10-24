import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { Product } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ProductImportRow = Record<string, unknown>;

function getStringField(record: ProductImportRow, key: string): string | null {
  const value = record[key];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }
  return value === null || value === undefined ? null : String(value);
}

function getNumberField(record: ProductImportRow, key: string): number {
  const value = record[key];
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(/,/g, '').trim();
    if (cleaned.length === 0) {
      return 0;
    }
    const parsed = Number.parseFloat(cleaned);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function mapImportRow(record: ProductImportRow): Prisma.ProductCreateManyInput {
  return {
    shipmentCode: getStringField(record, 'Shipment Code'),
    cvNumber: getStringField(record, 'CV Number'),
    noOfSacks: getNumberField(record, 'No. Of Sacks'),
    totalCBM: getNumberField(record, 'Total CBM'),
    weight: getNumberField(record, 'Weight'),
    shipmentStatus: getStringField(record, 'Shipment Status'),
    postingDate: getStringField(record, 'Posting Date'),
    orderDate: getStringField(record, 'Order Date'),
    payment: getStringField(record, 'Payment'),
    product: getStringField(record, 'Product'),
    productCode: getStringField(record, 'Product Code'),
    ageRange: getStringField(record, 'Age Range'),
    unit: getStringField(record, 'Unit'),
    unitPrice: getNumberField(record, 'Unit Price'),
    quantity: getNumberField(record, 'Quantity'),
    alibabaShippingCost: getNumberField(record, 'Alibaba Shipping Cost'),
    exchangeRates: getNumberField(record, 'Exchange Rates'),
    php: getNumberField(record, 'PHP'),
    subTotalPHP: getNumberField(record, 'Sub Total (PHP)'),
    transactionFee: getNumberField(record, 'Transaction Fee'),
    grandTotal: getNumberField(record, 'Grand Total'),
    forwardersFee: getNumberField(record, "Forwarder's Fee"),
    lalamove: getNumberField(record, 'Lalamove'),
    packagingCost: getNumberField(record, 'Packaging Cost'),
    suggestedPrice: getNumberField(record, 'Suggested Price'),
    actualPrice: getNumberField(record, 'Actual Price'),
    basePrice: getNumberField(record, 'Base Price'),
    cogs: getNumberField(record, 'COGS'),
    projectedSales: getNumberField(record, 'Projected Sales'),
    projectedProfit: getNumberField(record, 'Projected Profit'),
    projectedProfitPercent: getNumberField(record, 'Projected Profit (%)'),
    totalMarkup: getNumberField(record, 'Total Markup'),
  };
}

function mapDatabaseToFrontend(dbProduct: Product) {
  return {
    id: dbProduct.id,
    'Shipment Code': dbProduct.shipmentCode,
    'CV Number': dbProduct.cvNumber,
    'No. Of Sacks': dbProduct.noOfSacks,
    'Total CBM': dbProduct.totalCBM,
    Weight: dbProduct.weight,
    'Shipment Status': dbProduct.shipmentStatus,
    'Posting Date': dbProduct.postingDate,
    'Order Date': dbProduct.orderDate,
    Payment: dbProduct.payment,
    Product: dbProduct.product,
    'Product Code': dbProduct.productCode,
    'Age Range': dbProduct.ageRange,
    Unit: dbProduct.unit,
    'Unit Price': dbProduct.unitPrice,
    Quantity: dbProduct.quantity,
    'Alibaba Shipping Cost': dbProduct.alibabaShippingCost,
    'Exchange Rates': dbProduct.exchangeRates,
    PHP: dbProduct.php,
    'Sub Total (PHP)': dbProduct.subTotalPHP,
    'Transaction Fee': dbProduct.transactionFee,
    'Grand Total': dbProduct.grandTotal,
    "Forwarder's Fee": dbProduct.forwardersFee,
    Lalamove: dbProduct.lalamove,
    'Packaging Cost': dbProduct.packagingCost,
    'Suggested Price': dbProduct.suggestedPrice,
    'Actual Price': dbProduct.actualPrice,
    'Base Price': dbProduct.basePrice,
    COGS: dbProduct.cogs,
    'Projected Sales': dbProduct.projectedSales,
    'Projected Profit': dbProduct.projectedProfit,
    'Projected Profit (%)': dbProduct.projectedProfitPercent,
    'Total Markup': dbProduct.totalMarkup,
  };
}

// GET - Fetch all products (excluding soft-deleted)
export async function GET() {
  try {
    // ========================================================================
    // ⚠️ SOFT DELETE FILTER
    // ========================================================================
    const products = await prisma.product.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: { id: 'asc' },
    });

    // Transform database field names to frontend display names
    const transformedProducts = products.map(mapDatabaseToFrontend);

    return NextResponse.json(transformedProducts);
  } catch (error) {
    logger.error('Failed to fetch products:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch products',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// POST - Create products (single or bulk import)
export async function POST(request: NextRequest) {
  try {
    const requestData = await request.json();

    // ========================================================================
    // ⚠️ DATA VALIDATION - Array Format
    // ========================================================================
    if (!Array.isArray(requestData)) {
      return NextResponse.json(
        {
          error: 'Invalid data format',
          details: 'Expected an array of products',
        },
        { status: 400 }
      );
    }

    const productRecords = requestData as ProductImportRow[];

    if (productRecords.length === 0) {
      return NextResponse.json(
        {
          error: 'Invalid data format',
          details: 'Empty product array',
        },
        { status: 400 }
      );
    }

    // ========================================================================
    // ⚠️ BATCH SIZE LIMIT - Maximum 10000 records per import
    // ========================================================================
    if (productRecords.length > 10000) {
      logger.warn(
        `Batch size limit exceeded: ${productRecords.length} records (max 10000)`
      );
      return NextResponse.json(
        {
          error: 'Batch size limit exceeded',
          details: `You are trying to import ${productRecords.length} records. Maximum is 10,000 records per import.`,
          suggestion:
            'Please split your import into smaller batches of 10,000 records or less.',
        },
        { status: 413 } // Payload Too Large
      );
    }

    // Check if this is a single product addition or bulk import
    if (productRecords.length === 1) {
      // Single product addition - just add it to existing products
      const product = productRecords[0];
      const createdProduct = await prisma.product.create({
        data: mapImportRow(product),
      });

      logger.info('✅ Created single product');

      return NextResponse.json({
        message: 'Product added successfully',
        product: createdProduct,
      });
    }

    // ========================================================================
    // ⚠️ BULK IMPORT - Upsert/Restore Pattern
    // ========================================================================
    // Use upsert to maintain stable IDs and restore soft-deleted records
    // This preserves relationships and provides richer audit trail
    // ========================================================================
    const result = await prisma.$transaction(async (tx) => {
      let created = 0;
      let updated = 0;
      let restored = 0;

      for (const productData of productRecords) {
        const mappedData = mapImportRow(productData);
        const productCode = mappedData.productCode;

        if (!productCode) {
          continue; // Skip records without product code
        }

        // Check if product exists (including soft-deleted)
        const existing = await tx.product.findFirst({
          where: { productCode },
        });

        if (existing) {
          // Update existing product and restore if soft-deleted
          const wasDeleted = existing.deletedAt !== null;
          await tx.product.update({
            where: { id: existing.id },
            data: {
              ...mappedData,
              deletedAt: null, // Auto-restore if previously soft-deleted
            },
          });

          if (wasDeleted) {
            restored++;
          } else {
            updated++;
          }
        } else {
          // Create new product
          await tx.product.create({
            data: mappedData,
          });
          created++;
        }
      }

      return { created, updated, restored };
    });

    logger.info(
      `✅ Imported products: ${result.created} created, ${result.updated} updated, ${result.restored} restored`
    );

    return NextResponse.json({
      message: 'Products imported successfully',
      created: result.created,
      updated: result.updated,
      restored: result.restored,
      total: result.created + result.updated + result.restored,
    });
  } catch (error) {
    logger.error('Failed to process products:', error);

    // Enhanced error handling
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          {
            error: 'Duplicate product',
            details: 'A product with this information already exists',
            code: error.code,
          },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to process products',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// PUT - Bulk update all products (used for paste operations)
export async function PUT(request: NextRequest) {
  try {
    const productsData = await request.json();

    // ========================================================================
    // ⚠️ DATA VALIDATION - Array Format
    // ========================================================================
    if (!Array.isArray(productsData)) {
      return NextResponse.json(
        {
          error: 'Invalid data format',
          details: 'Expected an array of products',
        },
        { status: 400 }
      );
    }

    // ========================================================================
    // ⚠️ BATCH SIZE LIMIT - Maximum 10000 records per update
    // ========================================================================
    if (productsData.length > 10000) {
      logger.warn(
        `Batch size limit exceeded: ${productsData.length} records (max 10000)`
      );
      return NextResponse.json(
        {
          error: 'Batch size limit exceeded',
          details: `You are trying to update ${productsData.length} records. Maximum is 10,000 records per update.`,
          suggestion:
            'Please split your update into smaller batches of 10,000 records or less.',
        },
        { status: 413 } // Payload Too Large
      );
    }

    // ========================================================================
    // ⚠️ ATOMIC BULK UPDATE - Using upsert/restore pattern
    // ========================================================================
    // Upsert maintains stable IDs and restores soft-deleted records
    // ========================================================================
    const result = await prisma.$transaction(async (tx) => {
      let created = 0;
      let updated = 0;
      let restored = 0;

      const productRecords = productsData as ProductImportRow[];

      for (const productData of productRecords) {
        const mappedData = mapImportRow(productData);
        const productCode = mappedData.productCode;

        if (!productCode) {
          continue; // Skip records without product code
        }

        // Check if product exists (including soft-deleted)
        const existing = await tx.product.findFirst({
          where: { productCode },
        });

        if (existing) {
          // Update existing product and restore if soft-deleted
          const wasDeleted = existing.deletedAt !== null;
          await tx.product.update({
            where: { id: existing.id },
            data: {
              ...mappedData,
              deletedAt: null, // Auto-restore if previously soft-deleted
            },
          });

          if (wasDeleted) {
            restored++;
          } else {
            updated++;
          }
        } else {
          // Create new product
          await tx.product.create({
            data: mappedData,
          });
          created++;
        }
      }

      return { created, updated, restored };
    });

    logger.info(
      `✅ Atomically updated products: ${result.created} created, ${result.updated} updated, ${result.restored} restored`
    );

    return NextResponse.json({
      message: 'Products updated successfully',
      created: result.created,
      updated: result.updated,
      restored: result.restored,
      total: result.created + result.updated + result.restored,
    });
  } catch (error) {
    logger.error('Failed to update products:', error);

    // Enhanced error handling
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          {
            error: 'Duplicate product',
            details: 'A product with this information already exists',
            code: error.code,
          },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to update products',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete all products (with safety protection)
export async function DELETE(request: NextRequest) {
  try {
    // ========================================================================
    // ⚠️ MASS DELETION PROTECTION
    // ========================================================================
    const { searchParams } = new URL(request.url);
    const confirmParam = searchParams.get('confirm');

    if (confirmParam !== 'DELETE_ALL_PRODUCTS') {
      return NextResponse.json(
        {
          error: 'Mass deletion protection',
          details:
            'You must provide confirmation query parameter to delete all products',
          required: '?confirm=DELETE_ALL_PRODUCTS',
          example: '/api/products?confirm=DELETE_ALL_PRODUCTS',
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
    const alreadyDeleted = await prisma.product.count({
      where: { deletedAt: { not: null } },
    });

    const result = await prisma.product.updateMany({
      where: { deletedAt: null }, // Only soft-delete active records
      data: {
        deletedAt: new Date(),
      },
    });

    logger.info(
      `✅ Soft deleted ${result.count} products (${alreadyDeleted} were already deleted)`
    );

    return NextResponse.json({
      message: `Successfully deleted ${result.count} product records`,
      count: result.count,
      note: 'Records are soft-deleted and can be recovered if needed',
    });
  } catch (error) {
    logger.error('Failed to delete products:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete products',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
