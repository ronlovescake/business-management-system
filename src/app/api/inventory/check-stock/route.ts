import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface StockCheckRequest {
  productCode: string;
  requestedQuantity?: number;
}

interface StockCheckResponse {
  productCode: string;
  availableStock: number;
  requestedQuantity: number;
  status: 'IN_STOCK' | 'LOW_STOCK' | 'INSUFFICIENT_STOCK' | 'SOLD_OUT';
  canFulfill: boolean;
  message: string;
}

/**
 * POST /api/inventory/check-stock
 * Checks if a product has sufficient stock available
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as StockCheckRequest;
    const { productCode, requestedQuantity = 0 } = body;

    if (!productCode) {
      return NextResponse.json(
        { error: 'Product code is required' },
        { status: 400 }
      );
    }

    // Get product quantity from products table
    const product = await prisma.product.findFirst({
      where: {
        productCode: {
          equals: productCode.trim(),
          mode: 'insensitive',
        },
      },
      select: {
        quantity: true,
      },
    });

    if (!product) {
      return NextResponse.json(
        {
          productCode,
          availableStock: 0,
          requestedQuantity,
          status: 'SOLD_OUT',
          canFulfill: false,
          message: `Product "${productCode}" not found`,
        } as StockCheckResponse,
        { status: 200 }
      );
    }

    // Calculate total orders from non-cancelled transactions
    const totalOrderResult = await prisma.transaction.aggregate({
      where: {
        productCode: {
          equals: productCode.trim(),
          mode: 'insensitive',
        },
        orderStatus: {
          not: 'Cancelled',
        },
      },
      _sum: {
        quantity: true,
      },
    });

    const totalOrder = totalOrderResult._sum.quantity ?? 0;
    const quantity = product.quantity ?? 0;
    const availableStock = quantity - totalOrder;

    // Determine stock status
    let status: StockCheckResponse['status'];
    let canFulfill: boolean;
    let message: string;

    if (availableStock <= 0) {
      status = 'SOLD_OUT';
      canFulfill = false;
      message = `Product "${productCode}" is sold out (0 units available)`;
    } else if (availableStock < requestedQuantity) {
      status = 'INSUFFICIENT_STOCK';
      canFulfill = false;
      message = `Only ${availableStock} units available, but ${requestedQuantity} requested`;
    } else if (availableStock <= 20) {
      status = 'LOW_STOCK';
      canFulfill = true;
      // Show remaining stock AFTER the order
      const remainingAfterOrder = availableStock - requestedQuantity;
      message = `Only ${remainingAfterOrder} units remaining`;
    } else {
      status = 'IN_STOCK';
      canFulfill = true;
      message = `${availableStock} units available`;
    }

    const response: StockCheckResponse = {
      productCode,
      availableStock,
      requestedQuantity,
      status,
      canFulfill,
      message,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    logger.error('Error checking stock:', error);
    return NextResponse.json(
      { error: 'Failed to check stock availability' },
      { status: 500 }
    );
  }
}
