import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid product ID' },
        { status: 400 }
      );
    }

    const productData = await request.json();
    
    // Update the product in the database
    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        shipmentCode: productData['Shipment Code'] || null,
        cvNumber: productData['CV Number'] || null,
        noOfSacks: parseFloat(productData['No. Of Sacks']) || 0,
        totalCBM: parseFloat(productData['Total CBM']) || 0,
        weight: parseFloat(productData['Weight']) || 0,
        shipmentStatus: productData['Shipment Status'] || null,
        postingDate: productData['Posting Date'] || null,
        orderDate: productData['Order Date'] || null,
        payment: productData['Payment'] || null,
        product: productData['Product'] || null,
        productCode: productData['Product Code'] || null,
        ageRange: productData['Age Range'] || null,
        unit: productData['Unit'] || null,
        unitPrice: parseFloat(productData['Unit Price']) || 0,
        quantity: parseFloat(productData['Quantity']) || 0,
        alibabaShippingCost: parseFloat(productData['Alibaba Shipping Cost']) || 0,
        exchangeRates: parseFloat(productData['Exchange Rates']) || 0,
        php: parseFloat(productData['PHP']) || 0,
        subTotalPHP: parseFloat(productData['Sub Total (PHP)']) || 0,
        transactionFee: parseFloat(productData['Transaction Fee']) || 0,
        grandTotal: parseFloat(productData['Grand Total']) || 0,
        forwardersFee: parseFloat(productData['Forwarder\'s Fee']) || 0,
        lalamove: parseFloat(productData['Lalamove']) || 0,
        packagingCost: parseFloat(productData['Packaging Cost']) || 0,
        suggestedPrice: parseFloat(productData['Suggested Price']) || 0,
        actualPrice: parseFloat(productData['Actual Price']) || 0,
        basePrice: parseFloat(productData['Base Price']) || 0,
        cogs: parseFloat(productData['COGS']) || 0,
        projectedSales: parseFloat(productData['Projected Sales']) || 0,
        projectedProfit: parseFloat(productData['Projected Profit']) || 0,
        projectedProfitPercent: parseFloat(productData['Projected Profit (%)']) || 0,
        totalMarkup: parseFloat(productData['Total Markup']) || 0,
      }
    });

    return NextResponse.json({
      message: 'Product updated successfully',
      product: updatedProduct
    });
  } catch (error) {
    logger.error('Failed to update product:', error);
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid product ID' },
        { status: 400 }
      );
    }

    const product = await prisma.product.findUnique({
      where: { id }
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(product);
  } catch (error) {
    logger.error('Failed to fetch product:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid product ID' },
        { status: 400 }
      );
    }

    await prisma.product.delete({
      where: { id }
    });

    return NextResponse.json({
      message: 'Product deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete product:', error);
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}