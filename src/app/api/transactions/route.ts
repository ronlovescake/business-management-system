import { NextRequest, NextResponse } from 'next/server';
import type { Price, Prisma, Transaction } from '@prisma/client';
import { prisma } from '@/lib/db';

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

function parseNumeric(value: unknown): number {
  if (value === undefined || value === null || value === '') {
    return 0;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const str = String(value).replace(/,/g, '').trim();
  if (str.length === 0) {
    return 0;
  }

  const parsed = Number.parseFloat(str);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function parseTrimmed(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
}

function parseOptional(value: unknown): string | null {
  const trimmed = parseTrimmed(value);
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
  if (!productCode || !quantity || quantity <= 0) return 0;

  // Find all price tiers for this product code
  const productTiers = priceTiers.filter(
    (tier) => tier.productCode === productCode
  );

  if (productTiers.length === 0) return 0;

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

// GET - Fetch all transactions
export async function GET() {
  try {
    const transactions = await prisma.transaction.findMany({
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
    console.error('Failed to fetch transactions:', error);
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

    if (!Array.isArray(transactionsData) || transactionsData.length === 0) {
      return NextResponse.json(
        {
          error: 'Invalid data format. Expected array of transaction objects.',
        },
        { status: 400 }
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

    console.log(
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

    console.log(
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
          console.log(
            `Auto-calculated Unit Price for ${productCode} (Qty: ${quantity}): ${tierPriceInPeso} - ${discount} = ${unitPrice}`
          );
        }
      }

      let lineTotal = parseNumeric(row['Line Total']);
      if (lineTotal === 0) {
        lineTotal = calculateLineTotal(quantity, unitPrice, adjustment);
        console.log(
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

    console.log(
      `Inserting ${allDataToInsert.length} rows total (${dataToInsert.length} with data, ${emptyRowsData.length} empty)`
    );

    // Use createMany to insert all records in one transaction
    const result = await prisma.transaction.createMany({
      data: allDataToInsert,
    });

    return NextResponse.json({
      message: `Successfully imported ${result.count} transaction records`,
      count: result.count,
      withData: dataToInsert.length,
      empty: emptyRowsData.length,
    });
  } catch (error) {
    console.error('Failed to import transactions:', error);

    // Log the full error details for debugging
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
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

    // Convert UI format to database format
    const dbData: Prisma.TransactionUpdateInput = {};

    if ('Order Date' in updateData)
      dbData.orderDate = parseTrimmed(updateData['Order Date']);
    if ('Customers' in updateData)
      dbData.customers = parseTrimmed(updateData['Customers']);
    if ('Product Code' in updateData)
      dbData.productCode = parseTrimmed(updateData['Product Code']);
    if ('Quantity' in updateData)
      dbData.quantity = parseNumeric(updateData['Quantity']);
    if ('Unit Price' in updateData)
      dbData.unitPrice = parseNumeric(updateData['Unit Price']);
    if ('Discount' in updateData)
      dbData.discount = parseNumeric(updateData['Discount']);
    if ('Adjustment' in updateData)
      dbData.adjustment = parseNumeric(updateData['Adjustment']);
    if ('Line Total' in updateData)
      dbData.lineTotal = parseNumeric(updateData['Line Total']);
    if ('Order Status' in updateData)
      dbData.orderStatus = parseTrimmed(updateData['Order Status']);
    if ('Notes' in updateData)
      dbData.notes = parseOptional(updateData['Notes']);
    if ('Invoice Date' in updateData)
      dbData.invoiceDate = parseOptional(updateData['Invoice Date']);
    if ('Packed Date' in updateData)
      dbData.packedDate = parseOptional(updateData['Packed Date']);
    if ('Shipment Code' in updateData)
      dbData.shipmentCode = parseOptional(updateData['Shipment Code']);

    const updatedTransaction = await prisma.transaction.update({
      where: { id },
      data: dbData,
    });

    return NextResponse.json({
      message: 'Transaction updated successfully',
      transaction: updatedTransaction,
    });
  } catch (error) {
    console.error('Failed to update transaction:', error);
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
export async function DELETE() {
  try {
    const result = await prisma.transaction.deleteMany();

    return NextResponse.json({
      message: `Successfully deleted ${result.count} transaction records`,
      count: result.count,
    });
  } catch (error) {
    console.error('Failed to delete transactions:', error);
    return NextResponse.json(
      { error: 'Failed to delete transactions' },
      { status: 500 }
    );
  }
}
