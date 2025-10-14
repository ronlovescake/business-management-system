import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { Price, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

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

  if (typeof value === 'number') {
    return value;
  }

  const cleaned = value.toString().replace(/,/g, '').trim();
  if (cleaned.length === 0) {
    return 0;
  }

  const parsed = Number.parseFloat(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function mapToUpdateInput(
  priceData: PriceUpdatePayload
): Prisma.PriceUpdateInput {
  return {
    productCode: priceData['Product Code'],
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

// PUT - Update a single price by ID
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const priceData = (await request.json()) as PriceUpdatePayload;
    const priceId = parseInt(params.id);

    if (isNaN(priceId)) {
      return NextResponse.json({ error: 'Invalid price ID' }, { status: 400 });
    }

    // Convert UI format to database format
    const updatedPrice = await prisma.price.update({
      where: { id: priceId },
      data: mapToUpdateInput(priceData),
    });

    // Convert back to UI format
    const formattedPrice = mapToDTO(updatedPrice);

    return NextResponse.json({
      message: 'Price updated successfully',
      price: formattedPrice,
    });
  } catch (error) {
    logger.error('Failed to update price:', error);
    return NextResponse.json(
      { error: 'Failed to update price' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a single price by ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const priceId = parseInt(params.id);

    if (isNaN(priceId)) {
      return NextResponse.json({ error: 'Invalid price ID' }, { status: 400 });
    }

    await prisma.price.delete({
      where: { id: priceId },
    });

    return NextResponse.json({
      message: 'Price deleted successfully',
    });
  } catch (error) {
    logger.error('Failed to delete price:', error);
    return NextResponse.json(
      { error: 'Failed to delete price' },
      { status: 500 }
    );
  }
}
