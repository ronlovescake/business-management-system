import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      orderBy: { id: 'asc' }
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
      // If it's an array with multiple products, it's a bulk import (CSV)
      if (requestData.length > 1) {
        // Bulk import - clear existing products and insert new ones
        await prisma.product.deleteMany({});
        
        const createdProducts = await prisma.product.createMany({
          data: requestData.map((product: any) => ({
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
            alibabaShippingCost: parseFloat(product['Alibaba Shipping Cost']) || 0,
            exchangeRates: parseFloat(product['Exchange Rates']) || 0,
            php: parseFloat(product['PHP']) || 0,
            subTotalPHP: parseFloat(product['Sub Total (PHP)']) || 0,
            transactionFee: parseFloat(product['Transaction Fee']) || 0,
            grandTotal: parseFloat(product['Grand Total']) || 0,
            forwardersFee: parseFloat(product['Forwarder\'s Fee']) || 0,
            lalamove: parseFloat(product['Lalamove']) || 0,
            packagingCost: parseFloat(product['Packaging Cost']) || 0,
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
      } else if (requestData.length === 1) {
        // Single product addition - just add it to existing products
        const product = requestData[0];
        const createdProduct = await prisma.product.create({
          data: {
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
            alibabaShippingCost: parseFloat(product['Alibaba Shipping Cost']) || 0,
            exchangeRates: parseFloat(product['Exchange Rates']) || 0,
            php: parseFloat(product['PHP']) || 0,
            subTotalPHP: parseFloat(product['Sub Total (PHP)']) || 0,
            transactionFee: parseFloat(product['Transaction Fee']) || 0,
            grandTotal: parseFloat(product['Grand Total']) || 0,
            forwardersFee: parseFloat(product['Forwarder\'s Fee']) || 0,
            lalamove: parseFloat(product['Lalamove']) || 0,
            packagingCost: parseFloat(product['Packaging Cost']) || 0,
            suggestedPrice: parseFloat(product['Suggested Price']) || 0,
            actualPrice: parseFloat(product['Actual Price']) || 0,
            basePrice: parseFloat(product['Base Price']) || 0,
            cogs: parseFloat(product['COGS']) || 0,
            projectedSales: parseFloat(product['Projected Sales']) || 0,
            projectedProfit: parseFloat(product['Projected Profit']) || 0,
            projectedProfitPercent: parseFloat(product['Projected Profit (%)']) || 0,
            totalMarkup: parseFloat(product['Total Markup']) || 0,
          }
        });

        return NextResponse.json({
          message: 'Product added successfully',
          product: createdProduct
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

// DELETE - Clear all products
export async function DELETE() {
  try {
    const result = await prisma.product.deleteMany({});
    
    return NextResponse.json({
      message: `Successfully deleted ${result.count} product records`,
      count: result.count
    });
  } catch (error) {
    console.error('Failed to delete products:', error);
    return NextResponse.json(
      { error: 'Failed to delete products' },
      { status: 500 }
    );
  }
}