import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { Price, Transaction } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { sanitizers } from '@/lib/security/sanitize';
import { MAX_QUERY_LIMIT } from '@/constants/batch-sizes';

// ==============================================================================
// ⚠️ FINALIZED BUSINESS LOGIC - DO NOT MODIFY WITHOUT APPROVAL ⚠️
// ==============================================================================
// This API route contains the same finalized computation logic as the UI:
//
// Formula #1: Unit Price = Tier Price - Discount
// Formula #2: Line Total = (Quantity × Unit Price) - Adjustment
//
// These formulas MUST match the logic in the transactions page.
// Reference: TRANSACTIONS_LOGIC_SUMMARY.md
// ==============================================================================

/**
 * Helper function to get unit price based on product code and quantity
 *
 * ⚠️ FINALIZED LOGIC - Must match frontend logic
 *
 * @param productCode - The product code to lookup
 * @param quantity - The quantity to match against tier ranges
 * @param priceTiers - Array of price tiers from database
 * @returns The tier price or 0 if no match found
 */
type PriceTier = Pick<
  Price,
  'productCode' | 'lowerLimit' | 'upperLimit' | 'currentPrice'
>;
type TransactionImportRow = Record<string, unknown>;

const EMPTY_SHIPMENT_MARKER = '-';

/**
 * Helper function to log operations notification directly to database
 * This is server-side only - cannot use the client-side service
 *
 * Creates a new notification entry for each update. The frontend groups
 * notifications by transaction ID to show change history in a dropdown.
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
 * Parse and sanitize numeric value
 */
function parseNumeric(value: unknown): number {
  return sanitizers.number(value, { min: 0, decimals: 2 }) ?? 0;
}

/**
 * Parse and sanitize string value
 */
function parseTrimmed(value: unknown): string {
  return sanitizers.name(value);
}

/**
 * Parse and sanitize optional string value
 */
function parseOptional(value: unknown): string | null {
  const trimmed = sanitizers.name(value);
  return trimmed.length === 0 ? null : trimmed;
}

function isEmptyRow(row: TransactionImportRow): boolean {
  const orderDate = parseTrimmed(row['Order Date']);
  const customers = parseTrimmed(row['Customers']);
  const productCode = parseTrimmed(row['Product Code']);
  const shipmentCode = parseTrimmed(row['Shipment Code']);

  return (
    orderDate.length === 0 &&
    customers.length === 0 &&
    productCode.length === 0 &&
    shipmentCode === EMPTY_SHIPMENT_MARKER
  );
}

function isValidRow(row: TransactionImportRow): boolean {
  const orderDate = parseTrimmed(row['Order Date']);
  const customers = parseTrimmed(row['Customers']);
  const productCode = parseTrimmed(row['Product Code']);

  return orderDate.length > 0 && customers.length > 0 && productCode.length > 0;
}

function getUnitPriceForQuantity(
  productCode: string,
  quantity: number,
  priceTiers: PriceTier[]
): number {
  if (!productCode || !quantity || quantity <= 0) {
    return 0;
  }

  // Find all price tiers for this product code
  const productTiers = priceTiers.filter(
    (tier) => tier.productCode === productCode
  );

  if (productTiers.length === 0) {
    return 0;
  }

  // ⚠️ IMPORTANT: Limits are stored in cents (e.g., 100 = 1 unit)
  // Convert limits from cents to whole numbers for comparison
  // Find the tier that contains this quantity
  const matchingTier = productTiers.find((tier) => {
    const lowerLimit = tier.lowerLimit / 100; // Convert from cents
    const upperLimit = tier.upperLimit / 100; // Convert from cents
    return quantity >= lowerLimit && quantity <= upperLimit;
  });

  return matchingTier ? matchingTier.currentPrice : 0;
}

/**
 * Calculate Line Total
 *
 * ⚠️ FINALIZED FORMULA - Must match frontend logic
 * Formula: Line Total = (Quantity × Unit Price) - Adjustment
 *
 * @param quantity - Number of units
 * @param unitPrice - Price per unit (already includes discount)
 * @param adjustment - Order-level adjustment
 * @returns The calculated line total
 */
function calculateLineTotal(
  quantity: number,
  unitPrice: number,
  adjustment: number
): number {
  return quantity * unitPrice - adjustment;
}

// GET - Fetch all transactions (excluding soft-deleted)
export async function GET() {
  try {
    // ========================================================================
    // ⚠️ SOFT DELETE FILTER
    // ========================================================================
    // Exclude soft-deleted records by filtering where deletedAt is null
    // ========================================================================
    const transactions = await prisma.transaction.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: { id: 'asc' },
    });

    // Convert database format to UI format
    const formattedTransactions = transactions.map(
      (transaction: Transaction) => ({
        id: transaction.id,
        'Order Date': transaction.orderDate ?? '',
        Customers: transaction.customers ?? '',
        'Product Code': transaction.productCode ?? '',
        Quantity: transaction.quantity ?? 0,
        'Unit Price': transaction.unitPrice ?? 0,
        Discount: transaction.discount ?? 0,
        Adjustment: transaction.adjustment ?? 0,
        'Line Total': transaction.lineTotal ?? 0,
        'Order Status': transaction.orderStatus ?? '',
        Notes: transaction.notes ?? '',
        'Invoice Date': transaction.invoiceDate ?? '',
        'Packed Date': transaction.packedDate ?? '',
        'Shipment Code': transaction.shipmentCode ?? '',
      })
    );

    return NextResponse.json(formattedTransactions);
  } catch (error) {
    logger.error('Failed to fetch transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}

// POST - Create multiple transactions (for CSV import)
export async function POST(request: NextRequest) {
  try {
    const transactionsData = await request.json();

    // ========================================================================
    // ⚠️ DATA VALIDATION - Array Format
    // ========================================================================
    if (!Array.isArray(transactionsData) || transactionsData.length === 0) {
      return NextResponse.json(
        {
          error: 'Invalid data format',
          details: 'Expected array of transaction objects.',
        },
        { status: 400 }
      );
    }

    // ========================================================================
    // ⚠️ BATCH SIZE LIMIT - Maximum records per import
    // ========================================================================
    // Prevents:
    // - Database connection timeouts
    // - Memory exhaustion
    // - Transaction deadlocks
    // ========================================================================
    if (transactionsData.length > MAX_QUERY_LIMIT) {
      logger.warn(
        `Batch size limit exceeded: ${transactionsData.length} records (max ${MAX_QUERY_LIMIT})`
      );
      return NextResponse.json(
        {
          error: 'Batch size limit exceeded',
          details: `You are trying to import ${transactionsData.length} records. Maximum is ${MAX_QUERY_LIMIT.toLocaleString()} records per import.`,
          suggestion: `Please split your import into smaller batches of ${MAX_QUERY_LIMIT.toLocaleString()} records or less.`,
        },
        { status: 413 } // Payload Too Large
      );
    }

    // ========================================================================
    // ⚠️ CRITICAL: Fetch price tiers for Unit Price calculation
    // ========================================================================
    // We need the price tiers to calculate Unit Price for imported transactions
    // Formula: Unit Price = Tier Price - Discount
    // ========================================================================
    const priceTiers = await prisma.price.findMany({
      select: {
        productCode: true,
        lowerLimit: true,
        upperLimit: true,
        currentPrice: true,
      },
    });

    logger.debug(
      `Loaded ${priceTiers.length} price tiers for Unit Price calculation`
    );

    // DON'T clear existing transactions - we want to append new rows (e.g., when adding 10 empty rows)
    // await (prisma as any).transaction.deleteMany();

    // Separate empty rows from rows with data for different processing
    const transactionRows = transactionsData as TransactionImportRow[];

    const emptyRows = transactionRows.filter(isEmptyRow);

    const validTransactionsData = transactionRows.filter(
      (row) => isValidRow(row) && !isEmptyRow(row)
    );

    logger.debug(
      `Filtered ${validTransactionsData.length} valid records from ${transactionsData.length} total records`
    );

    // ========================================================================
    // ⚠️ FINALIZED AUTO-POPULATION LOGIC
    // ========================================================================
    // For each transaction:
    // 1. Calculate Unit Price = Tier Price - Discount
    // 2. Calculate Line Total = (Quantity × Unit Price) - Adjustment
    //
    // This MUST match the frontend logic in transactions page
    // ========================================================================
    const dataToInsert = validTransactionsData.map((row) => {
      const quantity = parseNumeric(row['Quantity']);
      const discount = parseNumeric(row['Discount']);
      const adjustment = parseNumeric(row['Adjustment']);
      const productCode = parseTrimmed(row['Product Code']);

      let unitPrice = parseNumeric(row['Unit Price']);

      if (unitPrice === 0 && quantity > 0 && productCode) {
        const tierPrice = getUnitPriceForQuantity(
          productCode,
          quantity,
          priceTiers
        );
        if (tierPrice > 0) {
          const tierPriceInPeso = tierPrice / 100;
          unitPrice = tierPriceInPeso - discount;
          logger.debug(
            `Auto-calculated Unit Price for ${productCode} (Qty: ${quantity}): ${tierPriceInPeso} - ${discount} = ${unitPrice}`
          );
        }
      }

      let lineTotal = parseNumeric(row['Line Total']);
      if (lineTotal === 0) {
        lineTotal = calculateLineTotal(quantity, unitPrice, adjustment);
        logger.debug(
          `Auto-calculated Line Total: (${quantity} × ${unitPrice}) - ${adjustment} = ${lineTotal}`
        );
      }

      return {
        orderDate: parseTrimmed(row['Order Date']),
        customers: parseTrimmed(row['Customers']),
        productCode,
        quantity,
        unitPrice,
        discount,
        adjustment,
        lineTotal,
        orderStatus: parseTrimmed(row['Order Status']) || 'Prepared',
        notes: parseOptional(row['Notes']),
        invoiceDate: parseOptional(row['Invoice Date']),
        packedDate: parseOptional(row['Packed Date']),
        shipmentCode: parseOptional(row['Shipment Code']),
      } satisfies Prisma.TransactionCreateManyInput;
    });

    // Process empty rows - store them with empty strings and "-" marker in Shipment Code
    const emptyRowsData = emptyRows.map(
      (row) =>
        ({
          orderDate: parseTrimmed(row['Order Date']),
          customers: parseTrimmed(row['Customers']),
          productCode: parseTrimmed(row['Product Code']),
          quantity: 0,
          unitPrice: 0,
          discount: 0,
          adjustment: 0,
          lineTotal: 0,
          orderStatus: parseTrimmed(row['Order Status']),
          notes: parseOptional(row['Notes']),
          invoiceDate: parseOptional(row['Invoice Date']),
          packedDate: parseOptional(row['Packed Date']),
          shipmentCode: EMPTY_SHIPMENT_MARKER,
        }) satisfies Prisma.TransactionCreateManyInput
    );

    // Combine rows with data and empty rows
    const allDataToInsert = [...dataToInsert, ...emptyRowsData];

    logger.debug(
      `Inserting ${allDataToInsert.length} rows total (${dataToInsert.length} with data, ${emptyRowsData.length} empty)`
    );

    // ========================================================================
    // ⚠️ REFERENCE INTEGRITY CHECKS
    // ========================================================================
    // Verify all referenced entities exist before bulk insert
    // This prevents 409 Conflict errors during import
    // ========================================================================

    // Extract unique customers, products, and shipments from the data
    const uniqueCustomers = Array.from(
      new Set(
        allDataToInsert
          .map((t) => t.customers)
          .filter((c): c is string => Boolean(c))
      )
    );

    const uniqueProducts = Array.from(
      new Set(
        allDataToInsert
          .map((t) => t.productCode)
          .filter((p): p is string => Boolean(p))
      )
    );

    const uniqueShipments = Array.from(
      new Set(
        allDataToInsert
          .map((t) => t.shipmentCode)
          .filter((s): s is string => Boolean(s) && s !== EMPTY_SHIPMENT_MARKER)
      )
    );

    logger.debug(
      `Checking references: ${uniqueCustomers.length} customers, ${uniqueProducts.length} products, ${uniqueShipments.length} shipments`
    );

    // Check which customers exist
    const existingCustomers = await prisma.customer.findMany({
      where: { customerName: { in: uniqueCustomers } },
      select: { customerName: true },
    });
    const existingCustomerNames = new Set(
      existingCustomers.map((c) => c.customerName)
    );
    const missingCustomers = uniqueCustomers.filter(
      (name) => !existingCustomerNames.has(name)
    );

    logger.debug(
      `🔍 Customer check: ${existingCustomers.length}/${uniqueCustomers.length} found`
    );
    if (missingCustomers.length > 0) {
      logger.warn(
        `Missing customers (first 10):`,
        missingCustomers.slice(0, 10)
      );
    }

    // Check which products exist
    const existingProducts = await prisma.product.findMany({
      where: { productCode: { in: uniqueProducts } },
      select: { productCode: true },
    });
    const existingProductCodes = new Set(
      existingProducts
        .map((p) => p.productCode)
        .filter((c): c is string => Boolean(c))
    );
    const missingProducts = uniqueProducts.filter(
      (code) => !existingProductCodes.has(code)
    );

    logger.debug(
      `🔍 Product check: ${existingProducts.length}/${uniqueProducts.length} found`
    );
    if (missingProducts.length > 0) {
      logger.warn(`Missing products (first 10):`, missingProducts.slice(0, 10));
    }

    // Check which shipments exist (only if there are shipments to check)
    let missingShipments: string[] = [];
    if (uniqueShipments.length > 0) {
      const existingShipments = await prisma.shipment.findMany({
        where: { shipmentCode: { in: uniqueShipments } },
        select: { shipmentCode: true },
      });
      const existingShipmentCodes = new Set(
        existingShipments.map((s) => s.shipmentCode)
      );
      missingShipments = uniqueShipments.filter(
        (code) => !existingShipmentCodes.has(code)
      );

      logger.debug(
        `🔍 Shipment check: ${existingShipments.length}/${uniqueShipments.length} found`
      );
      if (missingShipments.length > 0) {
        logger.warn(
          `Missing shipments (first 10):`,
          missingShipments.slice(0, 10)
        );
      }
    }

    // If any references are missing, return 409 Conflict with details
    if (
      missingCustomers.length > 0 ||
      missingProducts.length > 0 ||
      missingShipments.length > 0
    ) {
      logger.warn(
        `❌ Reference integrity check failed: ${missingCustomers.length} customers, ${missingProducts.length} products, ${missingShipments.length} shipments missing`
      );

      const customerSample = allDataToInsert
        .filter(
          (row) => row.customers && missingCustomers.includes(row.customers)
        )
        .slice(0, 5)
        .map((row) => ({
          customers: row.customers,
          productCode: row.productCode,
          orderDate: row.orderDate,
        }));

      const productSample = allDataToInsert
        .filter(
          (row) => row.productCode && missingProducts.includes(row.productCode)
        )
        .slice(0, 5)
        .map((row) => ({
          customers: row.customers,
          productCode: row.productCode,
          orderDate: row.orderDate,
        }));

      const shipmentSample = allDataToInsert
        .filter(
          (row) =>
            row.shipmentCode && missingShipments.includes(row.shipmentCode)
        )
        .slice(0, 5)
        .map((row) => ({
          customers: row.customers,
          productCode: row.productCode,
          orderDate: row.orderDate,
          shipmentCode: row.shipmentCode,
        }));

      // Log detailed breakdown for debugging
      logger.warn(
        `Missing customers (${missingCustomers.length}):`,
        missingCustomers
      );
      logger.warn(
        `Missing products (${missingProducts.length}):`,
        missingProducts
      );
      logger.warn(
        `Missing shipments (${missingShipments.length}):`,
        missingShipments
      );
      logger.warn('Sample rows with missing customers:', customerSample);
      logger.warn('Sample rows with missing products:', productSample);
      logger.warn('Sample rows with missing shipments:', shipmentSample);

      return NextResponse.json(
        {
          error: 'Reference integrity violation',
          details:
            'Some referenced entities do not exist in the database. Please create them first.',
          missing: {
            customers: missingCustomers.slice(0, 10), // Limit to first 10 for readability
            products: missingProducts.slice(0, 10),
            shipments: missingShipments.slice(0, 10),
          },
          counts: {
            customers: missingCustomers.length,
            products: missingProducts.length,
            shipments: missingShipments.length,
          },
          suggestion:
            'Import the missing entities first, then retry the transaction import.',
        },
        { status: 409 } // Conflict
      );
    }

    logger.info('✅ Reference integrity checks passed');

    // ========================================================================
    // ⚠️ ATOMIC BULK INSERT - Using prisma.$transaction
    // ========================================================================
    // Use createMany to insert all records in one transaction
    const result = await prisma.transaction.createMany({
      data: allDataToInsert,
    });

    // ========================================================================
    // ⚠️ LOG NOTIFICATION - Track changes in operations notifications
    // ========================================================================
    try {
      await logOperationNotification(
        'transactions',
        `Imported ${result.count} transaction records (${dataToInsert.length} with data, ${emptyRowsData.length} empty)`,
        {
          count: result.count,
          withData: dataToInsert.length,
          empty: emptyRowsData.length,
        }
      );
    } catch (notifError) {
      // Don't fail the request if notification logging fails
      logger.warn(
        'Failed to log notification for transaction import:',
        notifError
      );
    }

    return NextResponse.json({
      message: `Successfully imported ${result.count} transaction records`,
      count: result.count,
      withData: dataToInsert.length,
      empty: emptyRowsData.length,
    });
  } catch (error) {
    logger.error('Failed to import transactions:', error);

    // Log the full error details for debugging
    if (error instanceof Error) {
      logger.error('Error message:', error.message);
      logger.error('Error stack:', error.stack);
    }

    return NextResponse.json(
      {
        error: 'Failed to import transaction data to database',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// PUT - Bulk update multiple transactions
export async function PUT(request: NextRequest) {
  try {
    const updatePayload = await request.json();

    // ========================================================================
    // ⚠️ DATA VALIDATION - Array Format
    // ========================================================================
    if (!Array.isArray(updatePayload) || updatePayload.length === 0) {
      return NextResponse.json(
        {
          error: 'Invalid data format',
          details: 'Expected array of transactions to update',
        },
        { status: 400 }
      );
    }

    // ========================================================================
    // ⚠️ BATCH SIZE LIMIT - Maximum records per update
    // ========================================================================
    if (updatePayload.length > MAX_QUERY_LIMIT) {
      logger.warn(
        `Batch size limit exceeded: ${updatePayload.length} records (max ${MAX_QUERY_LIMIT})`
      );
      return NextResponse.json(
        {
          error: 'Batch size limit exceeded',
          details: `You are trying to update ${updatePayload.length} records. Maximum is ${MAX_QUERY_LIMIT.toLocaleString()} records per update.`,
          suggestion: `Please split your update into smaller batches of ${MAX_QUERY_LIMIT.toLocaleString()} records or less.`,
        },
        { status: 413 } // Payload Too Large
      );
    }

    const updateData = updatePayload as (TransactionImportRow & {
      id: unknown;
    })[];

    // ========================================================================
    // ⚠️ ATOMIC BULK UPDATES - Using prisma.$transaction
    // ========================================================================
    // All updates succeed or all fail together
    // Prevents partial updates that could corrupt data
    // ========================================================================

    // Track which fields are being updated across all transactions
    const fieldsUpdated = new Set<string>();
    const sampleValues = new Map<string, string[]>();

    const result = await prisma.$transaction(async (tx) => {
      const updates = await Promise.all(
        updateData.map(async (transaction) => {
          const id = Number(transaction.id);
          if (!Number.isFinite(id)) {
            throw new Error(`Invalid transaction ID: ${transaction.id}`);
          }

          // Fetch existing transaction to track before/after changes
          const existingTransaction = await tx.transaction.findUnique({
            where: { id },
            select: {
              orderDate: true,
              customers: true,
              productCode: true,
              quantity: true,
              unitPrice: true,
              discount: true,
              adjustment: true,
              lineTotal: true,
              orderStatus: true,
              notes: true,
              invoiceDate: true,
              packedDate: true,
              shipmentCode: true,
            },
          });

          if (!existingTransaction) {
            throw new Error(`Transaction ${id} not found`);
          }

          // Convert UI format to database format
          const dbData: Prisma.TransactionUpdateInput = {};
          const changeDetails: string[] = [];

          if ('Order Date' in transaction) {
            const value = parseTrimmed(transaction['Order Date']);
            const oldValue = existingTransaction.orderDate || 'empty';
            if (oldValue !== value) {
              changeDetails.push(`orderDate: ${oldValue} → ${value}`);
            }
            dbData.orderDate = value;
            fieldsUpdated.add('orderDate');
            if (!sampleValues.has('orderDate')) {
              sampleValues.set('orderDate', []);
            }
            const orderDateValues = sampleValues.get('orderDate');
            if (orderDateValues && orderDateValues.length < 3) {
              orderDateValues.push(value || '(empty)');
            }
          }
          if ('Customers' in transaction) {
            const value = parseTrimmed(transaction['Customers']);
            const oldValue = existingTransaction.customers || 'empty';
            if (oldValue !== value) {
              changeDetails.push(`customers: ${oldValue} → ${value}`);
            }
            dbData.customers = value;
            fieldsUpdated.add('customers');
            if (!sampleValues.has('customers')) {
              sampleValues.set('customers', []);
            }
            const customersValues = sampleValues.get('customers');
            if (customersValues && customersValues.length < 3) {
              customersValues.push(value || '(empty)');
            }
          }
          if ('Product Code' in transaction) {
            const value = parseTrimmed(transaction['Product Code']);
            const oldValue = existingTransaction.productCode || 'empty';
            if (oldValue !== value) {
              changeDetails.push(`productCode: ${oldValue} → ${value}`);
            }
            dbData.productCode = value;
            fieldsUpdated.add('productCode');
            if (!sampleValues.has('productCode')) {
              sampleValues.set('productCode', []);
            }
            const productCodeValues = sampleValues.get('productCode');
            if (productCodeValues && productCodeValues.length < 3) {
              productCodeValues.push(value || '(empty)');
            }
          }
          if ('Quantity' in transaction) {
            const value = parseNumeric(transaction['Quantity']);
            const oldValue = existingTransaction.quantity ?? 0;
            if (oldValue !== value) {
              changeDetails.push(`quantity: ${oldValue} → ${value}`);
            }
            dbData.quantity = value;
            fieldsUpdated.add('quantity');
            if (!sampleValues.has('quantity')) {
              sampleValues.set('quantity', []);
            }
            const quantityValues = sampleValues.get('quantity');
            if (quantityValues && quantityValues.length < 3) {
              quantityValues.push(String(value));
            }
          }
          if ('Unit Price' in transaction) {
            const value = parseNumeric(transaction['Unit Price']);
            const oldValue = existingTransaction.unitPrice ?? 0;
            if (oldValue !== value) {
              changeDetails.push(`unitPrice: ${oldValue} → ${value}`);
            }
            dbData.unitPrice = value;
            fieldsUpdated.add('unitPrice');
          }
          if ('Discount' in transaction) {
            const value = parseNumeric(transaction['Discount']);
            const oldValue = existingTransaction.discount ?? 0;
            if (oldValue !== value) {
              changeDetails.push(`discount: ${oldValue} → ${value}`);
            }
            dbData.discount = value;
            fieldsUpdated.add('discount');
          }
          if ('Adjustment' in transaction) {
            const value = parseNumeric(transaction['Adjustment']);
            const oldValue = existingTransaction.adjustment ?? 0;
            if (oldValue !== value) {
              changeDetails.push(`adjustment: ${oldValue} → ${value}`);
            }
            dbData.adjustment = value;
            fieldsUpdated.add('adjustment');
          }
          if ('Line Total' in transaction) {
            const value = parseNumeric(transaction['Line Total']);
            const oldValue = existingTransaction.lineTotal ?? 0;
            if (oldValue !== value) {
              changeDetails.push(`lineTotal: ${oldValue} → ${value}`);
            }
            dbData.lineTotal = value;
            fieldsUpdated.add('lineTotal');
          }
          if ('Order Status' in transaction) {
            const value = parseTrimmed(transaction['Order Status']);
            const oldValue = existingTransaction.orderStatus || 'empty';
            if (oldValue !== value) {
              changeDetails.push(`orderStatus: ${oldValue} → ${value}`);
            }
            dbData.orderStatus = value;
            fieldsUpdated.add('orderStatus');
            if (!sampleValues.has('orderStatus')) {
              sampleValues.set('orderStatus', []);
            }
            const orderStatusValues = sampleValues.get('orderStatus');
            if (orderStatusValues && orderStatusValues.length < 3) {
              orderStatusValues.push(value || '(empty)');
            }
          }
          if ('Notes' in transaction) {
            const value = parseOptional(transaction['Notes']);
            const oldValue = existingTransaction.notes || 'empty';
            if (oldValue !== value) {
              changeDetails.push(`notes: ${oldValue} → ${value || 'empty'}`);
            }
            dbData.notes = value;
            fieldsUpdated.add('notes');
          }
          if ('Invoice Date' in transaction) {
            const value = parseOptional(transaction['Invoice Date']);
            const oldValue = existingTransaction.invoiceDate || 'empty';
            if (oldValue !== value) {
              changeDetails.push(
                `invoiceDate: ${oldValue} → ${value || 'empty'}`
              );
            }
            dbData.invoiceDate = value;
            fieldsUpdated.add('invoiceDate');
          }
          if ('Packed Date' in transaction) {
            const value = parseOptional(transaction['Packed Date']);
            const oldValue = existingTransaction.packedDate || 'empty';
            if (oldValue !== value) {
              changeDetails.push(
                `packedDate: ${oldValue} → ${value || 'empty'}`
              );
            }
            dbData.packedDate = value;
            fieldsUpdated.add('packedDate');
          }
          if ('Shipment Code' in transaction) {
            const value = parseOptional(transaction['Shipment Code']);
            const oldValue = existingTransaction.shipmentCode || 'empty';
            if (oldValue !== value) {
              changeDetails.push(
                `shipmentCode: ${oldValue} → ${value || 'empty'}`
              );
            }
            dbData.shipmentCode = value;
            fieldsUpdated.add('shipmentCode');
          }

          const updated = await tx.transaction.update({
            where: { id },
            data: dbData,
          });

          return { transaction: updated, changeDetails, id };
        })
      );

      return updates;
    });

    logger.info(`✅ Atomically updated ${result.length} transactions`);

    // ========================================================================
    // ⚠️ LOG NOTIFICATIONS - One notification per unique transaction row with change details
    // ========================================================================
    try {
      // Group updates by transaction ID and collect all changes
      const transactionChanges = new Map<
        number,
        {
          customerName: string;
          productCode: string;
          changes: string[];
        }
      >();

      result.forEach((updateResult) => {
        const transactionId = updateResult.id;
        const transaction = updateResult.transaction;
        const changeDetails = updateResult.changeDetails;

        if (!transactionChanges.has(transactionId)) {
          transactionChanges.set(transactionId, {
            customerName: transaction.customers || '',
            productCode: transaction.productCode || '',
            changes: [...changeDetails],
          });
        } else {
          // Merge changes for same transaction
          const existing = transactionChanges.get(transactionId);
          if (existing) {
            existing.changes.push(...changeDetails);
            // Update customer/product if they changed
            if (transaction.customers) {
              existing.customerName = transaction.customers;
            }
            if (transaction.productCode) {
              existing.productCode = transaction.productCode;
            }
          }
        }
      });

      // Create one notification per unique transaction with full change history
      const notificationPromises = Array.from(transactionChanges.entries()).map(
        async ([transactionId, data]) => {
          // Build notification message in the format expected by the frontend
          // Format: "Updated transaction #123 - CustomerName (ProductCode) - Modified: field1: old → new, field2: old → new"
          let changeMessage = `Updated transaction #${transactionId}`;

          if (data.customerName && data.productCode) {
            changeMessage += ` - ${data.customerName} (${data.productCode})`;
          } else if (data.customerName) {
            changeMessage += ` - ${data.customerName}`;
          } else if (data.productCode) {
            changeMessage += ` - (${data.productCode})`;
          }

          if (data.changes.length > 0) {
            changeMessage += ` - Modified: ${data.changes.join(', ')}`;
          }

          await logOperationNotification('transactions', changeMessage, {
            transactionId: transactionId,
          });
        }
      );

      // Execute all notifications in parallel
      await Promise.all(notificationPromises);
      logger.info(
        `✅ Created ${notificationPromises.length} notifications for ${result.length} transaction updates`
      );
    } catch (notifError) {
      // Don't fail the request if notification logging fails
      logger.warn(
        'Failed to log notifications for transaction updates:',
        notifError
      );
    }

    return NextResponse.json({
      message: `Successfully updated ${result.length} transactions`,
      count: result.length,
    });
  } catch (error) {
    logger.error('Failed to bulk update transactions:', error);

    // Enhanced error handling with specific error types
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2025 = Record to update not found
      if (error.code === 'P2025') {
        return NextResponse.json(
          {
            error: 'Transaction not found',
            details: 'One or more transactions do not exist',
            code: error.code,
          },
          { status: 404 }
        );
      }
      // P2003 = Foreign key constraint failed
      if (error.code === 'P2003') {
        return NextResponse.json(
          {
            error: 'Reference integrity violation',
            details:
              'One or more referenced records (customers, products, shipments) do not exist',
            code: error.code,
          },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to bulk update transactions',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// PATCH - Update a single transaction
export async function PATCH(request: NextRequest) {
  try {
    const updatePayload = await request.json();

    if (
      typeof updatePayload !== 'object' ||
      updatePayload === null ||
      (updatePayload as Record<string, unknown>).id === undefined
    ) {
      return NextResponse.json(
        { error: 'Transaction ID is required' },
        { status: 400 }
      );
    }

    const updateData = updatePayload as TransactionImportRow & { id: unknown };
    const id = Number(updateData.id);
    if (!Number.isFinite(id)) {
      return NextResponse.json(
        { error: 'Transaction ID must be a number' },
        { status: 400 }
      );
    }

    // ========================================================================
    // ⚠️ FETCH OLD VALUES - For change tracking in notifications
    // ========================================================================
    const oldTransaction = await prisma.transaction.findUnique({
      where: { id },
    });

    if (!oldTransaction) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Convert UI format to database format
    const dbData: Prisma.TransactionUpdateInput = {};
    const changes: Array<{
      field: string;
      oldValue: string;
      newValue: string;
    }> = [];

    if ('Order Date' in updateData) {
      const newValue = parseTrimmed(updateData['Order Date']);
      dbData.orderDate = newValue;
      if (oldTransaction.orderDate !== newValue) {
        changes.push({
          field: 'orderDate',
          oldValue: oldTransaction.orderDate || 'empty',
          newValue: newValue || 'empty',
        });
      }
    }
    if ('Customers' in updateData) {
      const newValue = parseTrimmed(updateData['Customers']);
      dbData.customers = newValue;
      if (oldTransaction.customers !== newValue) {
        changes.push({
          field: 'customers',
          oldValue: oldTransaction.customers || 'empty',
          newValue: newValue || 'empty',
        });
      }
    }
    if ('Product Code' in updateData) {
      const newValue = parseTrimmed(updateData['Product Code']);
      dbData.productCode = newValue;
      if (oldTransaction.productCode !== newValue) {
        changes.push({
          field: 'productCode',
          oldValue: oldTransaction.productCode || 'empty',
          newValue: newValue || 'empty',
        });
      }
    }
    if ('Quantity' in updateData) {
      const newValue = parseNumeric(updateData['Quantity']);
      dbData.quantity = newValue;
      if (oldTransaction.quantity !== newValue) {
        changes.push({
          field: 'quantity',
          oldValue: String(oldTransaction.quantity ?? 0),
          newValue: String(newValue),
        });
      }
    }
    if ('Unit Price' in updateData) {
      const newValue = parseNumeric(updateData['Unit Price']);
      dbData.unitPrice = newValue;
      if (oldTransaction.unitPrice !== newValue) {
        changes.push({
          field: 'unitPrice',
          oldValue: String(oldTransaction.unitPrice ?? 0),
          newValue: String(newValue),
        });
      }
    }
    if ('Discount' in updateData) {
      const newValue = parseNumeric(updateData['Discount']);
      dbData.discount = newValue;
      if (oldTransaction.discount !== newValue) {
        changes.push({
          field: 'discount',
          oldValue: String(oldTransaction.discount ?? 0),
          newValue: String(newValue),
        });
      }
    }
    if ('Adjustment' in updateData) {
      const newValue = parseNumeric(updateData['Adjustment']);
      dbData.adjustment = newValue;
      if (oldTransaction.adjustment !== newValue) {
        changes.push({
          field: 'adjustment',
          oldValue: String(oldTransaction.adjustment ?? 0),
          newValue: String(newValue),
        });
      }
    }
    if ('Line Total' in updateData) {
      const newValue = parseNumeric(updateData['Line Total']);
      dbData.lineTotal = newValue;
      if (oldTransaction.lineTotal !== newValue) {
        changes.push({
          field: 'lineTotal',
          oldValue: String(oldTransaction.lineTotal ?? 0),
          newValue: String(newValue),
        });
      }
    }
    if ('Order Status' in updateData) {
      const newValue = parseTrimmed(updateData['Order Status']);
      dbData.orderStatus = newValue;
      if (oldTransaction.orderStatus !== newValue) {
        changes.push({
          field: 'orderStatus',
          oldValue: oldTransaction.orderStatus || 'empty',
          newValue: newValue || 'empty',
        });
      }
    }
    if ('Notes' in updateData) {
      const newValue = parseOptional(updateData['Notes']);
      dbData.notes = newValue;
      if (oldTransaction.notes !== newValue) {
        changes.push({
          field: 'notes',
          oldValue: oldTransaction.notes || 'empty',
          newValue: newValue || 'empty',
        });
      }
    }
    if ('Invoice Date' in updateData) {
      const newValue = parseOptional(updateData['Invoice Date']);
      dbData.invoiceDate = newValue;
      if (oldTransaction.invoiceDate !== newValue) {
        changes.push({
          field: 'invoiceDate',
          oldValue: oldTransaction.invoiceDate || 'empty',
          newValue: newValue || 'empty',
        });
      }
    }
    if ('Packed Date' in updateData) {
      const newValue = parseOptional(updateData['Packed Date']);
      dbData.packedDate = newValue;
      if (oldTransaction.packedDate !== newValue) {
        changes.push({
          field: 'packedDate',
          oldValue: oldTransaction.packedDate || 'empty',
          newValue: newValue || 'empty',
        });
      }
    }
    if ('Shipment Code' in updateData) {
      const newValue = parseOptional(updateData['Shipment Code']);
      dbData.shipmentCode = newValue;
      if (oldTransaction.shipmentCode !== newValue) {
        changes.push({
          field: 'shipmentCode',
          oldValue: oldTransaction.shipmentCode || 'empty',
          newValue: newValue || 'empty',
        });
      }
    }

    const updatedTransaction = await prisma.transaction.update({
      where: { id },
      data: dbData,
    });

    // ========================================================================
    // ⚠️ LOG NOTIFICATION - Track changes in operations notifications
    // ========================================================================
    try {
      const customerName = updatedTransaction.customers || 'Unknown Customer';
      const productCode = updatedTransaction.productCode || 'N/A';

      // Build detailed change message
      let changeMessage = '';
      if (changes.length === 0) {
        changeMessage = `Updated transaction #${id} - ${customerName} (${productCode}) - No actual changes detected`;
      } else if (changes.length === 1) {
        const change = changes[0];
        changeMessage = `Updated transaction #${id} - ${customerName} (${productCode}) - Modified: ${change.field}: ${change.oldValue} ---> ${change.newValue}`;
      } else {
        // Multiple changes
        const changeDetails = changes
          .map((c) => `${c.field}: ${c.oldValue} ---> ${c.newValue}`)
          .join(', ');
        changeMessage = `Updated transaction #${id} - ${customerName} (${productCode}) - Modified: ${changeDetails}`;
      }

      await logOperationNotification('transactions', changeMessage, {
        transactionId: id,
        customer: customerName,
        productCode: productCode,
        changes: changes,
      });
    } catch (notifError) {
      // Don't fail the request if notification logging fails
      logger.warn(
        'Failed to log notification for transaction update:',
        notifError
      );
    }

    return NextResponse.json({
      message: 'Transaction updated successfully',
      transaction: updatedTransaction,
    });
  } catch (error) {
    logger.error('Failed to update transaction:', error);
    return NextResponse.json(
      {
        error: 'Failed to update transaction',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete all transactions
// DELETE - Delete all transactions (with safety protection)
export async function DELETE(request: NextRequest) {
  try {
    // ========================================================================
    // ⚠️ MASS DELETION PROTECTION
    // ========================================================================
    // Require explicit confirmation query parameter to prevent accidental
    // deletion of all records
    // ========================================================================
    const { searchParams } = new URL(request.url);
    const confirmParam = searchParams.get('confirm');

    if (confirmParam !== 'DELETE_ALL_TRANSACTIONS') {
      return NextResponse.json(
        {
          error: 'Mass deletion protection',
          details:
            'You must provide confirmation query parameter to delete all transactions',
          required: '?confirm=DELETE_ALL_TRANSACTIONS',
          example: '/api/transactions?confirm=DELETE_ALL_TRANSACTIONS',
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
    // Use soft delete pattern: set deletedAt timestamp instead of removing
    // records. This allows data recovery and maintains audit trails.
    // ========================================================================

    // Check how many are already soft-deleted for observability
    const alreadyDeleted = await prisma.transaction.count({
      where: { deletedAt: { not: null } },
    });

    const result = await prisma.transaction.updateMany({
      where: { deletedAt: null }, // Only soft-delete active records
      data: {
        deletedAt: new Date(),
      },
    });

    logger.info(
      `✅ Soft deleted ${result.count} transactions (${alreadyDeleted} were already deleted)`
    );

    // ========================================================================
    // ⚠️ LOG NOTIFICATION - Track changes in operations notifications
    // ========================================================================
    try {
      await logOperationNotification(
        'transactions',
        `Deleted ${result.count} transaction records`,
        {
          count: result.count,
          alreadyDeleted,
        }
      );
    } catch (notifError) {
      // Don't fail the request if notification logging fails
      logger.warn(
        'Failed to log notification for transaction deletion:',
        notifError
      );
    }

    return NextResponse.json({
      message: `Successfully deleted ${result.count} transaction records`,
      count: result.count,
      note: 'Records are soft-deleted and can be recovered if needed',
    });
  } catch (error) {
    logger.error('Failed to delete transactions:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete transactions',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
