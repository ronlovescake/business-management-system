import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

type ProductImportRow = Record<string, unknown>;

function getStringField(record: ProductImportRow, key: string): string | null {
  const value = record[key];
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }
  return value == null ? null : String(value);
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

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      orderBy: { id: 'asc' },
    });

    return NextResponse.json(products);
  } catch (error) {
    console.error('Failed to fetch products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const requestData = await request.json();

    // Check if this is a single product addition or bulk import
    if (Array.isArray(requestData)) {
      const productRecords = requestData as ProductImportRow[];
      // If it's an array with multiple products, it's a bulk import (CSV)
      if (productRecords.length > 1) {
        // Bulk import - clear existing products and insert new ones
        await prisma.product.deleteMany({});
        const createdProducts = await prisma.product.createMany({
          data: productRecords.map(mapImportRow),
        });

        return NextResponse.json({
          message: 'Products imported successfully',
          count: createdProducts.count,
        });
      } else if (productRecords.length === 1) {
        // Single product addition - just add it to existing products
        const product = productRecords[0];
        const createdProduct = await prisma.product.create({
          data: mapImportRow(product),
        });

        return NextResponse.json({
          message: 'Product added successfully',
          product: createdProduct,
        });
      } else {
        return NextResponse.json(
          { error: 'Empty product array' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Expected an array of products' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Failed to process products:', error);
    return NextResponse.json(
      { error: 'Failed to process products' },
      { status: 500 }
    );
  }
}

// PUT - Bulk update all products (used for paste operations)
export async function PUT(request: NextRequest) {
  try {
    const productsData = await request.json();

    if (!Array.isArray(productsData)) {
      return NextResponse.json(
        { error: 'Expected an array of products' },
        { status: 400 }
      );
    }

    // Delete all existing products and insert the new ones
    // This is a full replacement operation
    await prisma.product.deleteMany({});
    const productRecords = productsData as ProductImportRow[];
    const formattedProducts = productRecords.map(mapImportRow);

    const result = await prisma.product.createMany({
      data: formattedProducts,
    });

    return NextResponse.json({
      message: 'Products updated successfully',
      count: result.count,
    });
  } catch (error) {
    console.error('Failed to update products:', error);
    return NextResponse.json(
      { error: 'Failed to update products' },
      { status: 500 }
    );
  }
}

// DELETE - Clear all products
export async function DELETE() {
  try {
    const result = await prisma.product.deleteMany({});

    return NextResponse.json({
      message: `Successfully deleted ${result.count} product records`,
      count: result.count,
    });
  } catch (error) {
    console.error('Failed to delete products:', error);
    return NextResponse.json(
      { error: 'Failed to delete products' },
      { status: 500 }
    );
  }
}
