import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: 'desc' }
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
    const products = await request.json();
    
    if (!Array.isArray(products)) {
      return NextResponse.json(
        { error: 'Expected an array of products' },
        { status: 400 }
      );
    }

    // Clear existing products and insert new ones
    await prisma.product.deleteMany({});
    
    const createdProducts = await prisma.product.createMany({
      data: products.map((product: any) => ({
        shipmentCode: product['Shipment Code'] || null,
        cvNumber: product['CV Number'] || null,
        noOfSacks: parseFloat(product['No. Of Sacks']) || 0,
        totalCBM: parseFloat(product['Total CBM']) || 0,
        weight: parseFloat(product['Weight']) || 0,
        shipmentStatus: product['Shipment Status'] || null,
        postingDate: product['Posting Date'] || null,
        orderDate: product['Order Date'] || null,
        payment: product['Payment'] || null,
        product: product['Product'] || null,
        productCode: product['Product Code'] || null,
        ageRange: product['Age Range'] || null,
        unit: product['Unit'] || null,
        unitPrice: parseFloat(product['Unit Price']) || 0,
        quantity: parseFloat(product['Quantity']) || 0,
        shippingFee1: parseFloat(product['Shipping Fee 1']) || 0,
        exchangeRates: parseFloat(product['Exchange Rates']) || 0,
        php: parseFloat(product['PHP']) || 0,
        subTotalPHP: parseFloat(product['Sub Total (PHP)']) || 0,
        transactionFee: parseFloat(product['Transaction Fee']) || 0,
        grandTotal: parseFloat(product['Grand Total']) || 0,
        shippingFee2: parseFloat(product['Shipping Fee 2']) || 0,
        shippingFee3: parseFloat(product['Shipping Fee 3']) || 0,
        packaging: parseFloat(product['Packaging']) || 0,
        suggestedPrice: parseFloat(product['Suggested Price']) || 0,
        actualPrice: parseFloat(product['Actual Price']) || 0,
        basePrice: parseFloat(product['Base Price']) || 0,
        cogs: parseFloat(product['COGS']) || 0,
        projectedSales: parseFloat(product['Projected Sales']) || 0,
        projectedProfit: parseFloat(product['Projected Profit']) || 0,
        projectedProfitPercent: parseFloat(product['Projected Profit (%)']) || 0,
        totalMarkup: parseFloat(product['Total Markup']) || 0,
      }))
    });

    return NextResponse.json({
      message: 'Products imported successfully',
      count: createdProducts.count
    });
  } catch (error) {
    console.error('Failed to import products:', error);
    return NextResponse.json(
      { error: 'Failed to import products' },
      { status: 500 }
    );
  }
}