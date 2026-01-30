import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { sanitizers } from '@/lib/security/sanitize';
import { mapToDTO } from '@/modules/products/api/dto';
import {
  postExpenseForProduct,
  postSupplierSettlementForProductPaymentChange,
} from '@/modules/products/api/service';

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

    const existingProduct = await prisma.product.findUnique({
      where: { id },
      select: { payment: true, productCode: true, shipmentCode: true },
    });

    const productData = await request.json();

    // Sanitize and update the product in the database
    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        // Sanitize code fields
        shipmentCode:
          sanitizers.productCode(productData['Shipment Code']) || null,
        cvNumber: sanitizers.name(productData['CV Number']) || null,
        productCode:
          sanitizers.productCode(productData['Product Code']) || null,

        // Sanitize text fields
        product: sanitizers.name(productData['Product']) || null,
        ageRange: sanitizers.name(productData['Age Range']) || null,
        unit: sanitizers.name(productData['Unit']) || null,
        shipmentStatus: sanitizers.name(productData['Shipment Status']) || null,
        payment: sanitizers.name(productData['Payment']) || null,
        paymentMethod: sanitizers.name(productData['Payment Method']) || null,
        paymentCardId: sanitizers.name(productData['Payment Card Id']) || null,
        linkToPost: sanitizers.url(productData['Link To Post']) || null,

        // Sanitize date fields
        postingDate: sanitizers.date(productData['Posting Date']) || null,
        orderDate: sanitizers.date(productData['Order Date']) || null,

        // Sanitize numeric fields
        noOfSacks:
          sanitizers.number(productData['No. Of Sacks'], {
            min: 0,
            decimals: 2,
          }) || 0,
        totalCBM:
          sanitizers.number(productData['Total CBM'], {
            min: 0,
            decimals: 2,
          }) || 0,
        weight:
          sanitizers.number(productData['Weight'], { min: 0, decimals: 2 }) ||
          0,
        unitPrice:
          sanitizers.number(productData['Unit Price'], {
            min: 0,
            decimals: 2,
          }) || 0,
        quantity:
          sanitizers.number(productData['Quantity'], { min: 0, decimals: 2 }) ||
          0,
        alibabaShippingCost:
          sanitizers.number(productData['Alibaba Shipping Cost'], {
            min: 0,
            decimals: 2,
          }) || 0,
        exchangeRates:
          sanitizers.number(productData['Exchange Rates'], {
            min: 0,
            decimals: 2,
          }) || 0,
        php:
          sanitizers.number(productData['PHP'], { min: 0, decimals: 2 }) || 0,
        subTotalPHP:
          sanitizers.number(productData['Sub Total (PHP)'], {
            min: 0,
            decimals: 2,
          }) || 0,
        transactionFee:
          sanitizers.number(productData['Transaction Fee'], {
            min: 0,
            decimals: 2,
          }) || 0,
        grandTotal:
          sanitizers.number(productData['Grand Total'], {
            min: 0,
            decimals: 2,
          }) || 0,
        forwardersFee:
          sanitizers.number(productData["Forwarder's Fee"], {
            min: 0,
            decimals: 2,
          }) || 0,
        lalamove:
          sanitizers.number(productData['Lalamove'], { min: 0, decimals: 2 }) ||
          0,
        packagingCost:
          sanitizers.number(productData['Packaging Cost'], {
            min: 0,
            decimals: 2,
          }) || 0,
        suggestedPrice:
          sanitizers.number(productData['Suggested Price'], {
            min: 0,
            decimals: 2,
          }) || 0,
        actualPrice:
          sanitizers.number(productData['Actual Price'], {
            min: 0,
            decimals: 2,
          }) || 0,
        basePrice:
          sanitizers.number(productData['Base Price'], {
            min: 0,
            decimals: 2,
          }) || 0,
        cogs:
          sanitizers.number(productData['COGS'], { min: 0, decimals: 2 }) || 0,
        projectedSales:
          sanitizers.number(productData['Projected Sales'], {
            min: 0,
            decimals: 2,
          }) || 0,
        projectedProfit:
          sanitizers.number(productData['Projected Profit'], { decimals: 2 }) ||
          0,
        projectedProfitPercent:
          sanitizers.number(productData['Projected Profit (%)'], {
            decimals: 2,
          }) || 0,
        totalMarkup:
          sanitizers.number(productData['Total Markup'], { decimals: 2 }) || 0,
        bulkQuantity:
          sanitizers.number(productData['Bulk Quantity'], {
            min: 0,
            decimals: 2,
          }) || 0,
        bulkWeight:
          sanitizers.number(productData['Bulk Weight'], {
            min: 0,
            decimals: 2,
          }) || 0,
        weightPerPiece:
          sanitizers.number(productData['Weight Per Piece'], {
            min: 0,
            decimals: 2,
          }) || 0,
      },
    });

    if (existingProduct) {
      try {
        await postSupplierSettlementForProductPaymentChange({
          productId: id,
          prevPayment: existingProduct.payment,
          nextPayment: updatedProduct.payment,
          productCode: updatedProduct.productCode,
          shipmentCode: updatedProduct.shipmentCode,
        });
      } catch (error) {
        logger.warn('Failed to post supplier settlement after product update', {
          error,
          productId: id,
        });
      }
    }

    try {
      const dto = mapToDTO(updatedProduct);
      await postExpenseForProduct(updatedProduct.id, dto);
    } catch (error) {
      logger.warn('Failed to post expense after product update', {
        error,
        productId: id,
      });
    }

    return NextResponse.json({
      message: 'Product updated successfully',
      product: updatedProduct,
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
      where: { id },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
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
      where: { id },
    });

    return NextResponse.json({
      message: 'Product deleted successfully',
    });
  } catch (error) {
    logger.error('Failed to delete product:', error);
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}
