import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
function getUnitPriceForQuantity(
  productCode: string,
  quantity: number,
  priceTiers: any[]
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
    const transactions = await (prisma as any).transaction.findMany({
      orderBy: { id: 'asc' },
    });

    // Convert database format to UI format
    const formattedTransactions = transactions.map((transaction: any) => ({
      id: transaction.id,
      'Order Date': transaction.orderDate,
      Customers: transaction.customers,
      'Product Code': transaction.productCode,
      Quantity: transaction.quantity,
      'Unit Price': transaction.unitPrice,
      Discount: transaction.discount,
      Adjustment: transaction.adjustment,
      'Line Total': transaction.lineTotal,
      'Order Status': transaction.orderStatus,
      Notes: transaction.notes || '',
      'Invoice Date': transaction.invoiceDate || '',
      'Packed Date': transaction.packedDate || '',
      'Shipment Code': transaction.shipmentCode || '',
    }));

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
    const priceTiers = await (prisma as any).price.findMany({
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
    const emptyRows = transactionsData.filter((txData: any) => {
      const isEmptyOrderDate =
        !txData['Order Date'] || txData['Order Date'].trim() === '';
      const isEmptyCustomer =
        !txData['Customers'] || txData['Customers'].trim() === '';
      const isEmptyProductCode =
        !txData['Product Code'] || txData['Product Code'].trim() === '';
      // Empty rows have a "-" marker in Shipment Code
      const hasEmptyMarker = txData['Shipment Code'] === '-';
      return (
        isEmptyOrderDate &&
        isEmptyCustomer &&
        isEmptyProductCode &&
        hasEmptyMarker
      );
    });

    const validTransactionsData = transactionsData.filter((txData: any) => {
      return (
        txData['Order Date'] &&
        txData['Order Date'].trim() !== '' &&
        txData['Customers'] &&
        txData['Customers'].trim() !== '' &&
        txData['Product Code'] &&
        txData['Product Code'].trim() !== ''
      );
    });

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
    const dataToInsert = validTransactionsData.map((txData: any) => {
      // Parse numeric values, handling empty strings and undefined
      const quantity =
        parseFloat(txData['Quantity']?.toString().replace(/,/g, '') || '0') ||
        0;
      const discount =
        parseFloat(txData['Discount']?.toString().replace(/,/g, '') || '0') ||
        0;
      const adjustment =
        parseFloat(txData['Adjustment']?.toString().replace(/,/g, '') || '0') ||
        0;
      const productCode = txData['Product Code'].trim();

      // ======================================================================
      // ⚠️ FINALIZED FORMULA #1: Unit Price = Tier Price - Discount
      // ======================================================================
      let unitPrice =
        parseFloat(txData['Unit Price']?.toString().replace(/,/g, '') || '0') ||
        0;

      // If Unit Price is 0 or empty, auto-calculate from price tiers
      if (unitPrice === 0 && quantity > 0 && productCode) {
        const tierPrice = getUnitPriceForQuantity(
          productCode,
          quantity,
          priceTiers
        );
        if (tierPrice > 0) {
          // Convert from cents to whole numbers and apply discount
          const tierPriceInPeso = tierPrice / 100;
          unitPrice = tierPriceInPeso - discount;
          console.log(
            `Auto-calculated Unit Price for ${productCode} (Qty: ${quantity}): ${tierPriceInPeso} - ${discount} = ${unitPrice}`
          );
        }
      }

      // ======================================================================
      // ⚠️ FINALIZED FORMULA #2: Line Total = (Quantity × Unit Price) - Adjustment
      // ======================================================================
      let lineTotal =
        parseFloat(txData['Line Total']?.toString().replace(/,/g, '') || '0') ||
        0;

      // If Line Total is 0 or empty, auto-calculate
      if (lineTotal === 0) {
        lineTotal = calculateLineTotal(quantity, unitPrice, adjustment);
        console.log(
          `Auto-calculated Line Total: (${quantity} × ${unitPrice}) - ${adjustment} = ${lineTotal}`
        );
      }

      return {
        orderDate: txData['Order Date'].trim(),
        customers: txData['Customers'].trim(),
        productCode: productCode,
        quantity: quantity,
        unitPrice: unitPrice, // Auto-calculated or from CSV
        discount: discount,
        adjustment: adjustment,
        lineTotal: lineTotal, // Auto-calculated or from CSV
        orderStatus: txData['Order Status']?.trim() || 'Prepared',
        notes: txData['Notes']?.trim() || null,
        invoiceDate: txData['Invoice Date']?.trim() || null,
        packedDate: txData['Packed Date']?.trim() || null,
        shipmentCode: txData['Shipment Code']?.trim() || null,
      };
    });

    // Process empty rows - store them with empty strings and "-" marker in Shipment Code
    const emptyRowsData = emptyRows.map((txData: any) => {
      const orderDate = txData['Order Date']?.trim();
      const customers = txData['Customers']?.trim();
      const productCode = txData['Product Code']?.trim();
      const orderStatus = txData['Order Status']?.trim();
      const notes = txData['Notes']?.trim();
      const invoiceDate = txData['Invoice Date']?.trim();
      const packedDate = txData['Packed Date']?.trim();

      return {
        orderDate: orderDate || '',
        customers: customers || '',
        productCode: productCode || '',
        quantity: 0,
        unitPrice: 0,
        discount: 0,
        adjustment: 0,
        lineTotal: 0,
        orderStatus: orderStatus || '',
        notes: notes || null,
        invoiceDate: invoiceDate || null,
        packedDate: packedDate || null,
        shipmentCode: '-', // Marker for empty row
      };
    });

    // Combine rows with data and empty rows
    const allDataToInsert = [...dataToInsert, ...emptyRowsData];

    console.log(
      `Inserting ${allDataToInsert.length} rows total (${dataToInsert.length} with data, ${emptyRowsData.length} empty)`
    );

    // Use createMany to insert all records in one transaction
    const result = await (prisma as any).transaction.createMany({
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

// DELETE - Delete all transactions
export async function DELETE() {
  try {
    const result = await (prisma as any).transaction.deleteMany();

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
