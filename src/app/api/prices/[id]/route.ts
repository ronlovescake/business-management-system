import type { NextRequest } from 'next/server';
import type { Price, Prisma } from '@prisma/client';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { sanitizers } from '@/lib/security/sanitize';

type PriceUpdatePayload = {
  'Product Code': string;
  'Lower Limit': number;
  'Upper Limit': number;
  Prices: number;
  'Price Adjustment': number;
};

function parseNumericField(value: number | string | undefined): number {
  if (value === undefined || value === null) {
    return 0;
  }

  // Use sanitizers.number for better validation
  const sanitized = sanitizers.number(value, { min: 0, decimals: 2 });
  return sanitized ?? 0;
}

function mapToUpdateInput(
  priceData: PriceUpdatePayload
): Prisma.PriceUpdateInput {
  return {
    productCode: sanitizers.productCode(priceData['Product Code']),
    lowerLimit: Math.round(parseNumericField(priceData['Lower Limit']) * 100),
    upperLimit: Math.round(parseNumericField(priceData['Upper Limit']) * 100),
    currentPrice: Math.round(parseNumericField(priceData['Prices']) * 100),
    priceAdjustment: Math.round(
      parseNumericField(priceData['Price Adjustment']) * 100
    ),
    updatedAt: new Date(),
  };
}

function mapToDTO(price: Price) {
  return {
    id: price.id,
    'Product Code': price.productCode,
    'Lower Limit': Math.round(price.lowerLimit / 100),
    'Upper Limit': Math.round(price.upperLimit / 100),
    Prices: Math.round(price.currentPrice / 100),
    'Price Adjustment': Math.round(price.priceAdjustment / 100),
  };
}
type RouteContext = { params: { id: string } };

export const PUT = withErrorHandler<RouteContext>(
  async (request: NextRequest, context) => {
    const idResult = parsePriceId(context);
    if ('error' in idResult) {
      return idResult.error;
    }

    const priceData = (await request.json()) as PriceUpdatePayload;
    const updatePayload = mapToUpdateInput(priceData);

    const existingPrice = await prisma.price.findUnique({
      where: { id: idResult.id },
    });

    if (!existingPrice) {
      return ApiResponse.notFound('Price');
    }

    const updatedPrice = await prisma.price.update({
      where: { id: idResult.id },
      data: updatePayload,
    });

    const formattedPrice = mapToDTO(updatedPrice);
    logger.info('Price updated', {
      id: idResult.id,
      productCode: formattedPrice['Product Code'],
    });

    return ApiResponse.success(formattedPrice, 'Price updated successfully');
  }
);

export const DELETE = withErrorHandler<RouteContext>(
  async (_request: NextRequest, context) => {
    const idResult = parsePriceId(context);
    if ('error' in idResult) {
      return idResult.error;
    }

    const existingPrice = await prisma.price.findUnique({
      where: { id: idResult.id },
    });

    if (!existingPrice) {
      return ApiResponse.notFound('Price');
    }

    await prisma.price.delete({
      where: { id: idResult.id },
    });

    logger.info('Price deleted', { id: idResult.id });

    return ApiResponse.success(
      { id: idResult.id },
      'Price deleted successfully'
    );
  }
);

function parsePriceId(
  context?: RouteContext
): { id: number } | { error: ReturnType<typeof ApiResponse.badRequest> } {
  const idParam = context?.params?.id ?? '';
  const priceId = Number(idParam);

  if (!idParam || Number.isNaN(priceId)) {
    return {
      error: ApiResponse.badRequest('Invalid price ID', {
        id: 'Provide a numeric price ID in the URL path.',
      }),
    };
  }

  return { id: priceId };
}
