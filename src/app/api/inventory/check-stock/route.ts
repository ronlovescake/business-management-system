import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import {
  checkClothingStock,
  type StockCheckRequest,
} from '@/modules/clothing/operations/products/services/stockCheckService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/inventory/check-stock
 * Checks if a product or bundle has sufficient stock available
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as StockCheckRequest;
    const productCode = body.productCode?.trim() ?? '';
    const requestedQuantity =
      typeof body.requestedQuantity === 'number' ? body.requestedQuantity : 0;

    if (!productCode) {
      return NextResponse.json(
        { error: 'Product code is required' },
        { status: 400 }
      );
    }
    const result = await checkClothingStock({
      productCode,
      requestedQuantity,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    logger.error('Error checking stock:', error);
    return NextResponse.json(
      { error: 'Failed to check stock availability' },
      { status: 500 }
    );
  }
}
