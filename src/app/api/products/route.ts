import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { Product } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { sanitizers } from '@/lib/security/sanitize';
import { MAX_QUERY_LIMIT } from '@/constants/batch-sizes';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ProductImportRow = Record<string, unknown>;

/**
 * Helper function to log operations notification directly to database
 * This is server-side only - cannot use the client-side service
 *
 * Creates a new notification entry for each update. The frontend groups
 * notifications by product ID to show change history in a dropdown.
 */
async function logOperationNotification(
  category: string,
  changes: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const id = randomUUID();
    const metadataJson = metadata ? JSON.stringify(metadata) : null;

    // Use current time in Philippine timezone
    const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' });
    const philippineTime = new Date(now);

    await prisma.$executeRaw`
      INSERT INTO "operations_notifications" (id, category, "user", changes, metadata, "createdAt")
      VALUES (${id}, ${category}, ${'Operations'}, ${changes}, ${metadataJson}::jsonb, ${philippineTime})
    `;
  } catch (error) {
    logger.warn('Failed to log operations notification:', error);
  }
}

/**
 * Sanitize and get string field from import record
 */
function getStringField(record: ProductImportRow, key: string): string | null {
  const value = record[key];
  // Use sanitizer for string cleaning
  const sanitized = sanitizers.name(value);
  return sanitized.length === 0 ? null : sanitized;
}

/**
 * Sanitize and get number field from import record
 */
function getNumberField(record: ProductImportRow, key: string): number {
  const value = record[key];
  // Use sanitizer for number validation
  const sanitized = sanitizers.number(value, { min: 0, decimals: 2 });
  return sanitized ?? 0;
}

/**
 * Map and sanitize import row to Prisma input
 * All fields are sanitized to prevent XSS and injection attacks
 */
function mapImportRow(record: ProductImportRow): Prisma.ProductCreateManyInput {
  return {
    // Sanitize code fields with productCode sanitizer
    shipmentCode: sanitizers.productCode(record['Shipment Code']) || null,
    cvNumber: getStringField(record, 'CV Number'),
    productCode: sanitizers.productCode(record['Product Code']) || null,

    // Sanitize text fields
    product: getStringField(record, 'Product'),
    ageRange: getStringField(record, 'Age Range'),
    unit: getStringField(record, 'Unit'),
    shipmentStatus: getStringField(record, 'Shipment Status'),
    payment: getStringField(record, 'Payment'),

    // Sanitize date fields
    postingDate: sanitizers.date(record['Posting Date']) || null,
    orderDate: sanitizers.date(record['Order Date']) || null,

    // Sanitize numeric fields (all with min: 0 for non-negative values)
    noOfSacks: getNumberField(record, 'No. Of Sacks'),
    totalCBM: getNumberField(record, 'Total CBM'),
    weight: getNumberField(record, 'Weight'),
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
    createdAt: dbProduct.createdAt.toISOString(),
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
    // ⚠️ BATCH SIZE LIMIT - Maximum records per import
    // ========================================================================
    if (productRecords.length > MAX_QUERY_LIMIT) {
      logger.warn(
        `Batch size limit exceeded: ${productRecords.length} records (max ${MAX_QUERY_LIMIT})`
      );
      return NextResponse.json(
        {
          error: 'Batch size limit exceeded',
          details: `You are trying to import ${productRecords.length} records. Maximum is ${MAX_QUERY_LIMIT.toLocaleString()} records per import.`,
          suggestion: `Please split your import into smaller batches of ${MAX_QUERY_LIMIT.toLocaleString()} records or less.`,
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
    // ⚠️ BATCH SIZE LIMIT - Maximum records per update
    // ========================================================================
    if (productsData.length > MAX_QUERY_LIMIT) {
      logger.warn(
        `Batch size limit exceeded: ${productsData.length} records (max ${MAX_QUERY_LIMIT})`
      );
      return NextResponse.json(
        {
          error: 'Batch size limit exceeded',
          details: `You are trying to update ${productsData.length} records. Maximum is ${MAX_QUERY_LIMIT.toLocaleString()} records per update.`,
          suggestion: `Please split your update into smaller batches of ${MAX_QUERY_LIMIT.toLocaleString()} records or less.`,
        },
        { status: 413 } // Payload Too Large
      );
    }

    // ========================================================================
    // ⚠️ ATOMIC BULK UPDATE - Using upsert/restore pattern with change tracking
    // ========================================================================
    // Upsert maintains stable IDs and restores soft-deleted records
    // Track changes for: Shipment Code, Product Code, Unit Price, Quantity,
    // Alibaba Shipping, Exchange Rate
    // ========================================================================
    const result = await prisma.$transaction(async (tx) => {
      let created = 0;
      let updated = 0;
      let restored = 0;

      const productRecords = productsData as ProductImportRow[];
      const changeTracking: Array<{
        productId: number;
        productCode: string;
        shipmentCode: string | null;
        changes: string[];
      }> = [];

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
          // Track changes for tracked fields only
          const changeDetails: string[] = [];

          // Shipment Code
          const oldShipmentCode = existing.shipmentCode;
          const newShipmentCode = mappedData.shipmentCode;
          const normalizedOldShipment = oldShipmentCode || '';
          const normalizedNewShipment = newShipmentCode || '';
          if (normalizedOldShipment !== normalizedNewShipment) {
            changeDetails.push(
              `shipmentCode: ${oldShipmentCode || 'empty'} → ${newShipmentCode || 'empty'}`
            );
          }

          // Product Code (shouldn't change, but track just in case)
          const oldProductCode = existing.productCode;
          const newProductCode = mappedData.productCode;
          const normalizedOldProduct = oldProductCode || '';
          const normalizedNewProduct = newProductCode || '';
          if (normalizedOldProduct !== normalizedNewProduct) {
            changeDetails.push(
              `productCode: ${oldProductCode || 'empty'} → ${newProductCode || 'empty'}`
            );
          }

          // Unit Price
          const oldUnitPrice = existing.unitPrice ?? 0;
          const newUnitPrice = mappedData.unitPrice ?? 0;
          if (oldUnitPrice !== newUnitPrice) {
            changeDetails.push(`unitPrice: ${oldUnitPrice} → ${newUnitPrice}`);
          }

          // Quantity
          const oldQuantity = existing.quantity ?? 0;
          const newQuantity = mappedData.quantity ?? 0;
          if (oldQuantity !== newQuantity) {
            changeDetails.push(`quantity: ${oldQuantity} → ${newQuantity}`);
          }

          // Alibaba Shipping Cost
          const oldAlibabaShipping = existing.alibabaShippingCost ?? 0;
          const newAlibabaShipping = mappedData.alibabaShippingCost ?? 0;
          if (oldAlibabaShipping !== newAlibabaShipping) {
            changeDetails.push(
              `alibabaShipping: ${oldAlibabaShipping} → ${newAlibabaShipping}`
            );
          }

          // Exchange Rate
          const oldExchangeRate = existing.exchangeRates ?? 0;
          const newExchangeRate = mappedData.exchangeRates ?? 0;
          if (oldExchangeRate !== newExchangeRate) {
            changeDetails.push(
              `exchangeRate: ${oldExchangeRate} → ${newExchangeRate}`
            );
          }

          // Update existing product and restore if soft-deleted
          const wasDeleted = existing.deletedAt !== null;
          await tx.product.update({
            where: { id: existing.id },
            data: {
              ...mappedData,
              deletedAt: null, // Auto-restore if previously soft-deleted
            },
          });

          // Track changes if any fields actually changed
          if (changeDetails.length > 0) {
            changeTracking.push({
              productId: existing.id,
              productCode: productCode,
              shipmentCode: newShipmentCode || null,
              changes: changeDetails,
            });
          }

          if (wasDeleted) {
            restored++;
          } else {
            updated++;
          }
        } else {
          // Create new product
          const newProduct = await tx.product.create({
            data: mappedData,
          });
          created++;

          // Track new product creation with initial values
          const changeDetails: string[] = [];
          if (mappedData.shipmentCode) {
            changeDetails.push(
              `shipmentCode: empty → ${mappedData.shipmentCode}`
            );
          }
          if (mappedData.productCode) {
            changeDetails.push(
              `productCode: empty → ${mappedData.productCode}`
            );
          }
          if (mappedData.unitPrice) {
            changeDetails.push(`unitPrice: 0 → ${mappedData.unitPrice}`);
          }
          if (mappedData.quantity) {
            changeDetails.push(`quantity: 0 → ${mappedData.quantity}`);
          }
          if (mappedData.alibabaShippingCost) {
            changeDetails.push(
              `alibabaShipping: 0 → ${mappedData.alibabaShippingCost}`
            );
          }
          if (mappedData.exchangeRates) {
            changeDetails.push(`exchangeRate: 0 → ${mappedData.exchangeRates}`);
          }

          if (changeDetails.length > 0) {
            changeTracking.push({
              productId: newProduct.id,
              productCode: productCode,
              shipmentCode: mappedData.shipmentCode || null,
              changes: changeDetails,
            });
          }
        }
      }

      return { created, updated, restored, changeTracking };
    });

    logger.info(
      `✅ Atomically updated products: ${result.created} created, ${result.updated} updated, ${result.restored} restored`
    );

    // ========================================================================
    // ⚠️ LOG NOTIFICATIONS - One notification per unique product with change details
    // ========================================================================
    try {
      // Create notifications for all products with changes
      const notificationPromises = result.changeTracking.map(
        async (tracked) => {
          // Build notification message
          // Format: "Updated product #123 - ProductCode (ShipmentCode) - Modified: field: old → new"
          let changeMessage = `Updated product #${tracked.productId}`;

          if (tracked.productCode && tracked.shipmentCode) {
            changeMessage += ` - ${tracked.productCode} (${tracked.shipmentCode})`;
          } else if (tracked.productCode) {
            changeMessage += ` - ${tracked.productCode}`;
          } else if (tracked.shipmentCode) {
            changeMessage += ` - (${tracked.shipmentCode})`;
          }

          if (tracked.changes.length > 0) {
            changeMessage += ` - Modified: ${tracked.changes.join(', ')}`;
          }

          await logOperationNotification('products', changeMessage, {
            productId: tracked.productId,
          });
        }
      );

      await Promise.all(notificationPromises);
      logger.info(
        `✅ Created ${notificationPromises.length} product notifications`
      );
    } catch (notifError) {
      // Don't fail the request if notification logging fails
      logger.warn('Failed to log product notifications:', notifError);
    }

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
